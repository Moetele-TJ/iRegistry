-- Admin reversal of confirmed org wallet top-ups (mirror user reverse_payment behavior)

ALTER TABLE public.org_payments
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reversed_by uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reversed_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_org_payments_reversed_at
  ON public.org_payments (reversed_at DESC);

CREATE OR REPLACE FUNCTION public.reverse_org_payment(
  p_org_payment_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_credits integer;
  v_status text;
  v_reversed_at timestamptz;
  v_balance integer;
BEGIN
  SELECT org_id, credits_granted, status, reversed_at
    INTO v_org_id, v_credits, v_status, v_reversed_at
  FROM public.org_payments
  WHERE id = p_org_payment_id
  FOR UPDATE;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::integer, 'Payment not found';
    RETURN;
  END IF;

  IF v_reversed_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::integer, 'Payment already reversed';
    RETURN;
  END IF;

  IF v_status <> 'CONFIRMED' THEN
    RETURN QUERY SELECT false, NULL::integer, 'Only CONFIRMED payments can be reversed';
    RETURN;
  END IF;

  IF v_credits IS NULL OR v_credits <= 0 THEN
    RETURN QUERY SELECT false, NULL::integer, 'No credits to reverse for this payment';
    RETURN;
  END IF;

  INSERT INTO public.org_credits (org_id, balance)
  VALUES (v_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.org_credits
  WHERE org_id = v_org_id
  FOR UPDATE;

  IF v_balance < v_credits THEN
    RETURN QUERY SELECT false, v_balance, 'Cannot reverse: organization has spent some of the credited balance';
    RETURN;
  END IF;

  UPDATE public.org_credits
  SET balance = balance - v_credits, updated_at = now()
  WHERE org_id = v_org_id
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
    v_org_id,
    'ADJUSTMENT',
    v_credits,
    NULL,
    p_org_payment_id::text,
    jsonb_build_object('kind', 'reverse-org-payment', 'reason', NULLIF(TRIM(p_reason), '')),
    p_actor_id
  );

  UPDATE public.org_payments
  SET
    status = 'CANCELLED',
    reversed_at = now(),
    reversed_by = p_actor_id,
    reversed_reason = NULLIF(TRIM(p_reason), '')
  WHERE id = p_org_payment_id;

  RETURN QUERY SELECT true, v_balance, 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_org_payment (uuid, uuid, text) TO service_role;
