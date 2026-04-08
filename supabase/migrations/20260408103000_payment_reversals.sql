-- Support reversing confirmed payments (admin)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reversed_by uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reversed_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reversed_at
  ON public.payments (reversed_at DESC);

-- Reverse a payment by creating a compensating ledger entry and subtracting credits.
-- Safety: only reverses if user has enough balance to subtract credits_granted.
CREATE OR REPLACE FUNCTION public.reverse_payment(
  p_payment_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text) AS $$
DECLARE
  v_user_id uuid;
  v_credits integer;
  v_status text;
  v_reversed_at timestamptz;
  v_balance integer;
BEGIN
  SELECT user_id, credits_granted, status, reversed_at
    INTO v_user_id, v_credits, v_status, v_reversed_at
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
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

  -- Lock credits row
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_balance < v_credits THEN
    RETURN QUERY SELECT false, v_balance, 'Cannot reverse: user has spent some of the credited balance';
    RETURN;
  END IF;

  UPDATE public.user_credits
  SET balance = balance - v_credits, updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (user_id, entry_type, amount, task_code, reference, metadata, created_by)
  VALUES (
    v_user_id,
    'REFUND',
    v_credits,
    NULL,
    p_payment_id::text,
    jsonb_build_object('kind','reverse-payment','reason',NULLIF(TRIM(p_reason),'')),
    p_actor_id
  );

  UPDATE public.payments
  SET
    status = 'CANCELLED',
    reversed_at = now(),
    reversed_by = p_actor_id,
    reversed_reason = NULLIF(TRIM(p_reason),'')
  WHERE id = p_payment_id;

  RETURN QUERY SELECT true, v_balance, 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

