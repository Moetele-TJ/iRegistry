-- Thin billing RPCs for create-item / update-item (shared rules, one place to audit).
-- Depends on: public._is_privileged_user (20260411120000_item_transfer_rpcs.sql), public.spend_credits

-- ---------------------------------------------------------------------------
-- create-item: lifetime free tier (2 × created_by) then ADD_ITEM on owner wallet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_add_item_registration_charge (
  p_owner_id uuid,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_cnt int;
BEGIN
  IF p_owner_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF public._is_privileged_user (p_actor_id) OR public._is_privileged_user (p_owner_id) THEN
    RETURN;
  END IF;

  SELECT count(*)::int
  INTO v_cnt
  FROM public.items
  WHERE created_by = p_owner_id;

  IF v_cnt < 2 THEN
    RETURN;
  END IF;

  SELECT s.success
  INTO v_ok
  FROM public.spend_credits (
    p_owner_id,
    'ADD_ITEM',
    NULL,
    jsonb_build_object ('kind', 'create-item')
  ) AS s
  LIMIT 1;

  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'INSUFFICIENT_ADD_ITEM';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- update-item: debit tasks in fixed order (MARK_STOLEN → UPLOAD_PHOTOS → EDIT_ITEM)
-- Edge passes booleans already derived from the same rules as update-item/index.ts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.debit_item_update_tasks (
  p_bill_to_user_id uuid,
  p_item_id uuid,
  p_mark_stolen boolean,
  p_upload_photos boolean,
  p_edit_item boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_bill_to_user_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF p_mark_stolen THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_bill_to_user_id,
      'MARK_STOLEN',
      p_item_id::text,
      jsonb_build_object ('kind', 'update-item', 'action', 'mark-stolen')
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_MARK_STOLEN';
    END IF;
  END IF;

  IF p_upload_photos THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_bill_to_user_id,
      'UPLOAD_PHOTOS',
      p_item_id::text,
      jsonb_build_object ('kind', 'update-item', 'action', 'upload-photos')
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_UPLOAD_PHOTOS';
    END IF;
  END IF;

  IF p_edit_item THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_credits (
      p_bill_to_user_id,
      'EDIT_ITEM',
      p_item_id::text,
      jsonb_build_object ('kind', 'update-item', 'action', 'edit-item')
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_EDIT_ITEM';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_add_item_registration_charge (uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_item_update_tasks (uuid, uuid, boolean, boolean, boolean) TO service_role;
