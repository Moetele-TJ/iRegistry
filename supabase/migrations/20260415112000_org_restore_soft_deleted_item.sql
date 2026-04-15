-- Restore soft-deleted organization-owned item:
-- optional RESTORE_ITEM spend from org wallet + clear deletedat

CREATE OR REPLACE FUNCTION public.restore_soft_deleted_org_item (
  p_org_id uuid,
  p_item_id uuid,
  p_skip_spend boolean DEFAULT false,
  p_created_by uuid DEFAULT NULL
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
  IF p_org_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  IF NOT p_skip_spend THEN
    SELECT s.success
    INTO v_ok
    FROM public.spend_org_credits (
      p_org_id,
      'RESTORE_ITEM',
      p_item_id::text,
      jsonb_build_object('kind', 'org-restore-item'),
      p_created_by
    ) AS s
    LIMIT 1;

    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;
  END IF;

  UPDATE public.items
  SET deletedat = NULL
  WHERE id = p_item_id
    AND owner_org_id = p_org_id
    AND deletedat IS NOT NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'RESTORE_FAILED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_soft_deleted_org_item (uuid, uuid, boolean, uuid) TO service_role;

