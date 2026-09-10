-- Fix ambiguous column refs: RETURNS TABLE out-params share names with table columns,
-- so unqualified lifetime_registered / pack_slots_remaining fail in UPDATE ... SET.

CREATE OR REPLACE FUNCTION public.livestock_consume_registration_slot(p_user_id uuid)
RETURNS TABLE (success boolean, message text, lifetime_registered integer, pack_slots_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_life int;
  v_slots int;
BEGIN
  INSERT INTO public.livestock_owner_packs (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT p.lifetime_registered, p.pack_slots_remaining
  INTO v_life, v_slots
  FROM public.livestock_owner_packs p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF v_life < 2 THEN
    UPDATE public.livestock_owner_packs AS p
    SET
      lifetime_registered = p.lifetime_registered + 1,
      updated_at = now()
    WHERE p.user_id = p_user_id
    RETURNING p.lifetime_registered, p.pack_slots_remaining
    INTO v_life, v_slots;

    RETURN QUERY SELECT true, 'FREE_TIER'::text, v_life, v_slots;
    RETURN;
  END IF;

  IF v_slots <= 0 THEN
    RETURN QUERY SELECT false, 'NEED_PACK'::text, v_life, v_slots;
    RETURN;
  END IF;

  UPDATE public.livestock_owner_packs AS p
  SET
    lifetime_registered = p.lifetime_registered + 1,
    pack_slots_remaining = p.pack_slots_remaining - 1,
    updated_at = now()
  WHERE p.user_id = p_user_id
  RETURNING p.lifetime_registered, p.pack_slots_remaining
  INTO v_life, v_slots;

  RETURN QUERY SELECT true, 'PACK_SLOT'::text, v_life, v_slots;
END;
$$;

CREATE OR REPLACE FUNCTION public.livestock_grant_registration_pack(p_user_id uuid)
RETURNS TABLE (success boolean, message text, pack_slots_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_bal integer;
  v_msg text;
  v_slots int;
BEGIN
  SELECT s.success, s.new_balance, s.message
  INTO v_ok, v_bal, v_msg
  FROM public.spend_credits(
    p_user_id,
    'LIVESTOCK_REGISTER_PACK',
    NULL,
    jsonb_build_object('kind', 'livestock-register-pack')
  ) AS s
  LIMIT 1;

  IF v_ok IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, coalesce(v_msg, 'INSUFFICIENT_CREDITS')::text, NULL::integer;
    RETURN;
  END IF;

  INSERT INTO public.livestock_owner_packs (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.livestock_owner_packs AS p
  SET
    pack_slots_remaining = p.pack_slots_remaining + 10,
    updated_at = now()
  WHERE p.user_id = p_user_id
  RETURNING p.pack_slots_remaining INTO v_slots;

  RETURN QUERY SELECT true, 'OK'::text, v_slots;
END;
$$;
