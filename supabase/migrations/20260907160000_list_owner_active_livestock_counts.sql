-- One-row-per-owner counts for non-deleted livestock.
-- Used by list-users for admin/cashier pickers (Livestock "View as").

CREATE OR REPLACE FUNCTION public.list_owner_active_livestock_counts ()
RETURNS TABLE (
  owner_id uuid,
  animal_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.owner_id,
    count(*)::bigint AS animal_count
  FROM public.livestock_animals a
  WHERE a.deleted_at IS NULL
    AND a.status IS DISTINCT FROM 'deleted'
  GROUP BY a.owner_id;
$$;

REVOKE ALL ON FUNCTION public.list_owner_active_livestock_counts () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_owner_active_livestock_counts () TO service_role;
