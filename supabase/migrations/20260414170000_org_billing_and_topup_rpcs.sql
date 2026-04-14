-- -----------------------------------------------------------------------------
-- Organization wallet billing + cashier top-up (transactional)
-- -----------------------------------------------------------------------------
-- Depends on:
-- - public.org_credits, public.org_credit_ledger (20260414153000_orgs_core.sql)
-- - public.task_catalog (20260408100000_credits_and_billing.sql)
-- - public.set_updated_at (20260408100000_credits_and_billing.sql)
-- -----------------------------------------------------------------------------

-- -----------------------------
-- 1) Add credits to org wallet
-- -----------------------------
CREATE OR REPLACE FUNCTION public.add_org_credits (
  p_org_id uuid,
  p_amount integer,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_org_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    success := false;
    new_balance := NULL;
    message := 'INVALID_PAYLOAD';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Ensure org_credits row exists
  INSERT INTO public.org_credits (org_id, balance)
  VALUES (p_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE public.org_credits
  SET balance = balance + p_amount
  WHERE org_id = p_org_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.org_credit_ledger (
    org_id,
    entry_type,
    amount,
    task_code,
    reference,
    metadata,
    created_by
  )
  VALUES (
    p_org_id,
    'CREDIT_ADD',
    p_amount,
    NULL,
    p_reference,
    p_metadata,
    p_created_by
  );

  success := true;
  new_balance := v_balance;
  message := 'OK';
  RETURN NEXT;
END;
$$;

-- -----------------------------
-- 2) Spend credits from org wallet
-- -----------------------------
CREATE OR REPLACE FUNCTION public.spend_org_credits (
  p_org_id uuid,
  p_task_code text,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost integer;
  v_balance integer;
BEGIN
  IF p_org_id IS NULL OR p_task_code IS NULL THEN
    success := false;
    new_balance := NULL;
    message := 'INVALID_PAYLOAD';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT credits_cost INTO v_cost
  FROM public.task_catalog
  WHERE code = p_task_code AND active = true;

  IF v_cost IS NULL THEN
    success := false;
    new_balance := NULL;
    message := 'TASK_NOT_FOUND';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Ensure org_credits row exists (even for 0-cost tasks).
  INSERT INTO public.org_credits (org_id, balance)
  VALUES (p_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  -- Zero-cost tasks are allowed, but still create a ledger row for audit.
  IF v_cost = 0 THEN
  INSERT INTO public.org_credit_ledger (
      org_id,
      entry_type,
      amount,
      task_code,
      reference,
      metadata,
      created_by
    )
    VALUES (
      p_org_id,
      'CREDIT_SPEND',
    0,
      p_task_code,
      p_reference,
      p_metadata,
      p_created_by
    );

    success := true;
    new_balance := (SELECT balance FROM public.org_credits WHERE org_id = p_org_id);
    message := 'OK';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT balance INTO v_balance
  FROM public.org_credits
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF v_balance < v_cost THEN
    success := false;
    new_balance := v_balance;
    message := 'INSUFFICIENT_CREDITS';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.org_credits
  SET balance = balance - v_cost
  WHERE org_id = p_org_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.org_credit_ledger (
    org_id,
    entry_type,
    amount,
    task_code,
    reference,
    metadata,
    created_by
  )
  VALUES (
    p_org_id,
    'CREDIT_SPEND',
    v_cost,
    p_task_code,
    p_reference,
    p_metadata,
    p_created_by
  );

  success := true;
  new_balance := v_balance;
  message := 'OK';
  RETURN NEXT;
END;
$$;

-- -----------------------------
-- 3) Update-item composite spend (Org wallet)
-- -----------------------------
CREATE OR REPLACE FUNCTION public.debit_org_item_update_tasks (
  p_org_id uuid,
  p_item_id uuid,
  p_mark_stolen boolean,
  p_upload_photos boolean,
  p_edit_item boolean,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_org_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF p_mark_stolen THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_org_credits (
      p_org_id,
      'MARK_STOLEN',
      p_item_id::text,
      jsonb_build_object ('kind', 'org-update-item', 'action', 'mark-stolen'),
      p_actor_user_id
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_MARK_STOLEN';
    END IF;
  END IF;

  IF p_upload_photos THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_org_credits (
      p_org_id,
      'UPLOAD_PHOTOS',
      p_item_id::text,
      jsonb_build_object ('kind', 'org-update-item', 'action', 'upload-photos'),
      p_actor_user_id
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_UPLOAD_PHOTOS';
    END IF;
  END IF;

  IF p_edit_item THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_org_credits (
      p_org_id,
      'EDIT_ITEM',
      p_item_id::text,
      jsonb_build_object ('kind', 'org-update-item', 'action', 'edit-item'),
      p_actor_user_id
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_EDIT_ITEM';
    END IF;
  END IF;
END;
$$;

-- -----------------------------
-- 4) Org payments + cashier top-up (composite)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.org_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('CASHIER','ONLINE')),
  status text NOT NULL CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','FAILED')),
  currency text NOT NULL DEFAULT 'BWP',
  amount numeric NOT NULL DEFAULT 0,
  credits_granted integer NOT NULL CHECK (credits_granted > 0),
  provider text NULL,
  provider_reference text NULL,
  cashier_user_id uuid NULL REFERENCES public.users(id),
  receipt_no text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_org_payments_org_created_at
  ON public.org_payments (org_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_payments TO service_role;

CREATE OR REPLACE FUNCTION public.cashier_confirm_org_topup (
  p_target_org_id uuid,
  p_currency text,
  p_amount numeric,
  p_credits_granted integer,
  p_cashier_user_id uuid,
  p_receipt_no text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (payment_id uuid, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_ok boolean;
  v_bal integer;
BEGIN
  IF p_target_org_id IS NULL OR p_credits_granted IS NULL OR p_credits_granted <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  INSERT INTO public.org_payments (
    org_id,
    channel,
    status,
    currency,
    amount,
    credits_granted,
    provider,
    provider_reference,
    cashier_user_id,
    receipt_no,
    metadata,
    confirmed_at
  )
  VALUES (
    p_target_org_id,
    'CASHIER',
    'CONFIRMED',
    coalesce(nullif(trim(both FROM p_currency), ''), 'BWP'),
    p_amount,
    p_credits_granted,
    NULL,
    NULL,
    p_cashier_user_id,
    trim(both FROM coalesce(p_receipt_no, '')),
    p_metadata,
    now()
  )
  RETURNING id INTO v_payment_id;

  SELECT s.success, s.new_balance
  INTO v_ok, v_bal
  FROM public.add_org_credits (
    p_target_org_id,
    p_credits_granted,
    v_payment_id::text,
    p_metadata,
    p_cashier_user_id
  ) AS s
  LIMIT 1;

  IF v_ok IS DISTINCT FROM true OR v_bal IS NULL THEN
    RAISE EXCEPTION 'ADD_CREDITS_FAILED';
  END IF;

  payment_id := v_payment_id;
  new_balance := v_bal;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_org_credits (uuid, integer, text, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_org_credits (uuid, text, text, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_org_item_update_tasks (uuid, uuid, boolean, boolean, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cashier_confirm_org_topup (uuid, text, numeric, integer, uuid, text, jsonb) TO service_role;

