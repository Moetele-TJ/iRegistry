-- Composite RPCs: billing + related writes in a single transaction (no orphaned rows).
-- Pairs with edge function updates: cashier-topup, restore-item, notify-owner, verify-item.

-- ---------------------------------------------------------------------------
-- Cashier: insert CONFIRMED payment + add_credits (rolls back together on failure)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashier_confirm_topup (
  p_target_user_id uuid,
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
  IF p_target_user_id IS NULL OR p_credits_granted IS NULL OR p_credits_granted <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  INSERT INTO public.payments (
    user_id,
    channel,
    status,
    currency,
    amount,
    credits_granted,
    provider,
    provider_reference,
    cashier_user_id,
    receipt_no,
    confirmed_at
  )
  VALUES (
    p_target_user_id,
    'CASHIER',
    'CONFIRMED',
    coalesce(nullif(trim(both FROM p_currency), ''), 'BWP'),
    p_amount,
    p_credits_granted,
    NULL,
    NULL,
    p_cashier_user_id,
    trim(both FROM coalesce(p_receipt_no, '')),
    now()
  )
  RETURNING id INTO v_payment_id;

  SELECT s.success, s.new_balance
  INTO v_ok, v_bal
  FROM public.add_credits (
    p_target_user_id,
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

-- ---------------------------------------------------------------------------
-- Restore soft-deleted item: optional RESTORE_ITEM spend + clear deletedat
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_soft_deleted_item (
  p_item_id uuid,
  p_charge_user_id uuid,
  p_skip_spend boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_n int;
BEGIN
  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF NOT p_skip_spend THEN
    IF p_charge_user_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYLOAD';
    END IF;

    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_charge_user_id,
      'RESTORE_ITEM',
      p_item_id::text,
      jsonb_build_object ('kind', 'restore-item')
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  END IF;

  UPDATE public.items
  SET deletedat = NULL
  WHERE id = p_item_id
    AND deletedat IS NOT NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'RESTORE_FAILED';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notify owner: optional NOTIFY_OWNER spend + request_attempts + item_notifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_owner_deliver (
  p_item_id uuid,
  p_owner_id uuid,
  p_ip text,
  p_action_key text,
  p_message text,
  p_contact text,
  p_notify_police boolean,
  p_apply_spend boolean DEFAULT false,
  p_spender_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_item_id IS NULL OR p_owner_id IS NULL OR p_ip IS NULL OR p_action_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF p_apply_spend THEN
    IF p_spender_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYLOAD';
    END IF;

    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_spender_id,
      'NOTIFY_OWNER',
      p_item_id::text,
      jsonb_build_object (
        'kind', 'notify-owner',
        'ip', p_ip,
        'notifyPolice', coalesce(p_notify_police, false)
      )
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  END IF;

  INSERT INTO public.request_attempts (ip, action)
  VALUES (p_ip, p_action_key);

  INSERT INTO public.item_notifications (
    itemid,
    ownerid,
    recipient_type,
    message,
    contact
  )
  VALUES (
    p_item_id,
    p_owner_id,
    'owner',
    coalesce(p_message, ''),
    NULLIF(trim(both FROM coalesce(p_contact, '')), '')
  );

  IF coalesce(p_notify_police, false) THEN
    INSERT INTO public.item_notifications (
      itemid,
      ownerid,
      recipient_type,
      message,
      contact
    )
    VALUES (
      p_item_id,
      p_owner_id,
      'police',
      coalesce(p_message, ''),
      NULLIF(trim(both FROM coalesce(p_contact, '')), '')
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Verify item: optional VERIFY_ITEM_SERIAL spend + request_attempts log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_item_record_attempt (
  p_item_id uuid,
  p_ip text,
  p_action_key text,
  p_apply_spend boolean DEFAULT false,
  p_spender_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_item_id IS NULL OR p_ip IS NULL OR p_action_key IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF p_apply_spend THEN
    IF p_spender_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_PAYLOAD';
    END IF;

    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_spender_id,
      'VERIFY_ITEM_SERIAL',
      p_item_id::text,
      jsonb_build_object ('kind', 'verify-item', 'ip', p_ip)
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  END IF;

  INSERT INTO public.request_attempts (ip, action)
  VALUES (p_ip, p_action_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cashier_confirm_topup (uuid, text, numeric, integer, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_soft_deleted_item (uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_owner_deliver (uuid, uuid, text, text, text, text, boolean, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_item_record_attempt (uuid, text, text, boolean, uuid) TO service_role;
