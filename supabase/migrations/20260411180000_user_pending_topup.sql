-- User-initiated pending top-ups; staff completes via confirm_pending_topup_staff.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_user
  ON public.payments (user_id)
  WHERE status = 'PENDING';

CREATE OR REPLACE FUNCTION public.confirm_pending_topup_staff (
  p_payment_id uuid,
  p_staff_id uuid,
  p_receipt_no text,
  p_extra_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.payments%ROWTYPE;
  v_ok boolean;
  v_bal integer;
  v_note text;
BEGIN
  IF p_payment_id IS NULL OR p_staff_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::integer, 'Invalid payload';
    RETURN;
  END IF;

  v_note := nullif(trim(both FROM coalesce(p_extra_metadata->>'note', '')), '');

  SELECT * INTO r FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::integer, 'Payment not found';
    RETURN;
  END IF;

  IF r.status IS DISTINCT FROM 'PENDING' THEN
    RETURN QUERY SELECT false, NULL::integer, 'Payment is not pending';
    RETURN;
  END IF;

  IF r.credits_granted IS NULL OR r.credits_granted <= 0 THEN
    RETURN QUERY SELECT false, NULL::integer, 'Invalid credits on pending payment';
    RETURN;
  END IF;

  UPDATE public.payments
  SET
    status = 'CONFIRMED',
    channel = 'CASHIER',
    cashier_user_id = p_staff_id,
    receipt_no = trim(both FROM coalesce(p_receipt_no, '')),
    confirmed_at = now(),
    metadata = coalesce(r.metadata, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object(
        'completed_via', to_jsonb('staff_pending_topup'::text),
        'staff_completion_note', CASE WHEN v_note IS NULL THEN NULL ELSE to_jsonb(v_note) END
      )
    )
  WHERE id = p_payment_id;

  SELECT s.success, s.new_balance
  INTO v_ok, v_bal
  FROM public.add_credits(
    r.user_id,
    r.credits_granted,
    p_payment_id::text,
    jsonb_build_object(
      'kind', 'pending-topup-confirmed',
      'package_id', r.metadata->>'package_id'
    ),
    p_staff_id
  ) AS s
  LIMIT 1;

  IF v_ok IS DISTINCT FROM true OR v_bal IS NULL THEN
    RAISE EXCEPTION 'ADD_CREDITS_FAILED_PENDING';
  END IF;

  RETURN QUERY SELECT true, v_bal, 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pending_topup_staff (uuid, uuid, text, jsonb) TO service_role;
