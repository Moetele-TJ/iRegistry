-- Item transfer requests + RPCs (source of truth for flows previously only on remote DB).
-- Aligns with:
--   create-transfer-request, cancel-transfer-request, review-transfer-request, get-pending-transfer-requests,
--   transfer-item-ownership (admin).
--
-- Billing: request_item_transfer and review_item_transfer call public.spend_credits inside the same
-- transaction so credits + row changes commit or roll back together.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  current_owner_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  resolved_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_item_transfer_requests_owner_pending
  ON public.item_transfer_requests (current_owner_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_transfer_requests_item
  ON public.item_transfer_requests (item_id);

-- At most one open PENDING request per item
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_transfer_one_pending_per_item
  ON public.item_transfer_requests (item_id)
  WHERE (status = 'PENDING');

COMMENT ON TABLE public.item_transfer_requests IS
'Buyer-initiated ownership transfer; owner approves in-app. Billing is enforced in RPCs via spend_credits.';

-- ---------------------------------------------------------------------------
-- Admin direct transfer audit (evidence from transfer-item-ownership edge)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_admin_ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
  previous_owner_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  new_owner_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_admin_ownership_transfers_item
  ON public.item_admin_ownership_transfers (item_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_privileged_user (p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((SELECT role FROM public.users WHERE id = p_user_id), '')) IN ('admin', 'cashier');
$$;

-- ---------------------------------------------------------------------------
-- request_item_transfer: validation + optional REQUEST_TRANSFER spend + insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_item_transfer (
  p_item_id uuid,
  p_requester_id uuid,
  p_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.items%ROWTYPE;
  v_ok boolean;
BEGIN
  IF p_item_id IS NULL OR p_requester_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF v_item.deletedat IS NOT NULL THEN
    RAISE EXCEPTION 'ITEM_DELETED';
  END IF;

  IF v_item.status = 'Stolen' THEN
    RAISE EXCEPTION 'ITEM_STOLEN';
  END IF;

  IF v_item.ownerid = p_requester_id THEN
    RAISE EXCEPTION 'ALREADY_OWNER';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.item_transfer_requests r
    WHERE r.item_id = p_item_id
      AND r.status = 'PENDING'
      AND r.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'PENDING_REQUEST_EXISTS';
  END IF;

  -- Billing: mirror create-transfer-request edge (non-privileged pay REQUEST_TRANSFER)
  IF NOT public._is_privileged_user (p_requester_id) THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_requester_id,
      'REQUEST_TRANSFER',
      p_item_id::text,
      jsonb_build_object ('kind', 'create-transfer-request')
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  END IF;

  INSERT INTO public.item_transfer_requests (
    item_id,
    requester_id,
    current_owner_id,
    status,
    message,
    expires_at
  )
  VALUES (
    p_item_id,
    p_requester_id,
    v_item.ownerid,
    'PENDING',
    NULLIF(trim(both FROM coalesce(p_message, '')), ''),
    now() + interval '14 days'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- cancel_item_transfer_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_item_transfer_request (
  p_request_id uuid,
  p_requester_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.item_transfer_requests%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_requester_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT *
  INTO v_req
  FROM public.item_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_req.requester_id <> p_requester_id THEN
    RAISE EXCEPTION 'NOT_REQUEST_OWNER';
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING';
  END IF;

  IF v_req.expires_at <= now() THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.items i WHERE i.id = v_req.item_id AND i.deletedat IS NOT NULL) THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  UPDATE public.item_transfer_requests
  SET
    status = 'CANCELLED',
    resolved_at = now()
  WHERE id = p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- review_item_transfer: approve/reject + TRANSFER_OWNERSHIP spend on approve (same txn)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_item_transfer (
  p_request_id uuid,
  p_owner_id uuid,
  p_decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.item_transfer_requests%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_decision text := upper(trim(both FROM coalesce(p_decision, '')));
  v_ok boolean;
BEGIN
  IF p_request_id IS NULL OR p_owner_id IS NULL OR v_decision = '' THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;

  IF v_decision NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;

  SELECT *
  INTO v_req
  FROM public.item_transfer_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'REQUEST_NOT_PENDING';
  END IF;

  IF v_req.expires_at <= now() THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  IF v_req.current_owner_id <> p_owner_id THEN
    RAISE EXCEPTION 'NOT_ITEM_OWNER';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = v_req.item_id
  FOR UPDATE;

  IF NOT FOUND OR v_item.deletedat IS NOT NULL THEN
    RAISE EXCEPTION 'ITEM_DELETED';
  END IF;

  IF v_item.ownerid <> p_owner_id THEN
    RAISE EXCEPTION 'NOT_ITEM_OWNER';
  END IF;

  IF v_item.status = 'Stolen' THEN
    RAISE EXCEPTION 'ITEM_STOLEN';
  END IF;

  IF v_decision = 'REJECTED' THEN
    UPDATE public.item_transfer_requests
    SET
      status = 'REJECTED',
      resolved_at = now()
    WHERE id = p_request_id;
    RETURN;
  END IF;

  -- APPROVED: bill current owner (unless privileged) then transfer
  IF NOT public._is_privileged_user (p_owner_id) THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_owner_id,
      'TRANSFER_OWNERSHIP',
      p_request_id::text,
      jsonb_build_object ('kind', 'review-transfer-request')
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  END IF;

  UPDATE public.items
  SET
    ownerid = v_req.requester_id
  WHERE id = v_req.item_id;

  UPDATE public.item_transfer_requests
  SET
    status = 'APPROVED',
    resolved_at = now()
  WHERE id = p_request_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- transfer_item_ownership (admin + evidence) — single transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_item_ownership (
  p_item_id uuid,
  p_new_owner_id uuid,
  p_actor_id uuid,
  p_evidence jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.items%ROWTYPE;
  v_new_owner uuid;
BEGIN
  IF p_item_id IS NULL OR p_new_owner_id IS NULL OR p_actor_id IS NULL OR p_evidence IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT id
  INTO v_new_owner
  FROM public.users
  WHERE id = p_new_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEW_OWNER_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF v_item.deletedat IS NOT NULL THEN
    RAISE EXCEPTION 'ITEM_IS_DELETED';
  END IF;

  IF v_item.ownerid = p_new_owner_id THEN
    RAISE EXCEPTION 'NEW_OWNER_SAME_AS_CURRENT';
  END IF;

  INSERT INTO public.item_admin_ownership_transfers (
    item_id,
    previous_owner_id,
    new_owner_id,
    actor_id,
    evidence
  )
  VALUES (
    p_item_id,
    v_item.ownerid,
    p_new_owner_id,
    p_actor_id,
    p_evidence
  );

  UPDATE public.items
  SET ownerid = p_new_owner_id
  WHERE id = p_item_id;

  -- Cancel any pending in-app transfer requests for this item
  UPDATE public.item_transfer_requests
  SET
    status = 'CANCELLED',
    resolved_at = now()
  WHERE
    item_id = p_item_id
    AND status = 'PENDING';
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants (PostgREST / Edge service role)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.item_transfer_requests TO service_role;
GRANT SELECT, INSERT ON public.item_admin_ownership_transfers TO service_role;

GRANT EXECUTE ON FUNCTION public.request_item_transfer (uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_item_transfer_request (uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_item_transfer (uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_item_ownership (uuid, uuid, uuid, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- public_registry_stats (used by get-public-stats edge; was missing from repo)
-- Replace remote definition if return type differs (CREATE OR REPLACE cannot
-- change return type — must DROP first).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.public_registry_stats ();

CREATE OR REPLACE FUNCTION public.public_registry_stats ()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'registeredItems', (
      SELECT count(*)::int
      FROM public.items
      WHERE deletedat IS NULL
    ),
    'stolenItems', (
      SELECT count(*)::int
      FROM public.items
      WHERE deletedat IS NULL
        AND status = 'Stolen'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_registry_stats () TO service_role;
