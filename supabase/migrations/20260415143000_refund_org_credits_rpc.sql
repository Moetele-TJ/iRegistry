-- -----------------------------------------------------------------------------
-- Refund credits to org wallet (ledger entry_type = REFUND)
-- -----------------------------------------------------------------------------
-- Purpose:
-- - Keep refunds distinguishable from normal top-ups (CREDIT_ADD) in org_credit_ledger.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refund_org_credits (
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
    'REFUND',
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

