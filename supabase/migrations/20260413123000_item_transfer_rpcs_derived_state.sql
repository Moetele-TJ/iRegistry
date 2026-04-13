-- Update item transfer RPCs to treat item state as derived:
-- - stolen is derived from reportedstolenat (not items.status)
-- - deleted remains deletedat

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

  IF v_item.legacyat IS NOT NULL THEN
    RAISE EXCEPTION 'ITEM_LEGACY';
  END IF;

  IF v_item.reportedstolenat IS NOT NULL THEN
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

  IF v_item.legacyat IS NOT NULL THEN
    RAISE EXCEPTION 'ITEM_LEGACY';
  END IF;

  IF v_item.ownerid <> p_owner_id THEN
    RAISE EXCEPTION 'NOT_ITEM_OWNER';
  END IF;

  IF v_item.reportedstolenat IS NOT NULL THEN
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
        AND legacyat IS NULL
    ),
    'stolenItems', (
      SELECT count(*)::int
      FROM public.items
      WHERE deletedat IS NULL
        AND legacyat IS NULL
        AND reportedstolenat IS NOT NULL
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.request_item_transfer (uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_item_transfer (uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_registry_stats () TO service_role;

