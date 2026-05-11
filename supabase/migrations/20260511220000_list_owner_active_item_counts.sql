-- One-row-per-owner counts for active (non-deleted, non-legacy) personal items.
-- Used by list-users for admin/cashier pickers (e.g. Items "View as").

CREATE OR REPLACE FUNCTION public.list_owner_active_item_counts ()
RETURNS TABLE (
  owner_id uuid,
  item_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.ownerid AS owner_id,
    count(*)::bigint AS item_count
  FROM public.items i
  WHERE i.deletedat IS NULL
    AND i.legacyat IS NULL
  GROUP BY i.ownerid;
$$;

REVOKE ALL ON FUNCTION public.list_owner_active_item_counts () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_owner_active_item_counts () TO service_role;
