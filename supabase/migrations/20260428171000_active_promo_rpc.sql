-- Return active promo details for a given user (system or user promo).
-- Used by validate-session so the UI can display "Promotional mode until …".

CREATE OR REPLACE FUNCTION public.get_active_promo_for_user(p_user_id uuid)
RETURNS TABLE (
  promo_id uuid,
  scope text,
  starts_at timestamptz,
  proposed_ends_at timestamptz,
  ended_at timestamptz,
  effective_ends_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  WITH active AS (
    SELECT
      c.id AS promo_id,
      c.scope,
      c.starts_at,
      c.proposed_ends_at,
      c.ended_at,
      public.promo_effective_end(c.proposed_ends_at, c.ended_at) AS effective_ends_at,
      CASE WHEN c.scope = 'user' THEN 1 ELSE 2 END AS precedence
    FROM public.promo_campaigns c
    WHERE (c.scope = 'system' OR (c.scope = 'user' AND c.user_id = p_user_id))
      AND now() >= c.starts_at
      AND now() < public.promo_effective_end(c.proposed_ends_at, c.ended_at)
  )
  SELECT promo_id, scope, starts_at, proposed_ends_at, ended_at, effective_ends_at
  FROM active
  ORDER BY precedence ASC, starts_at DESC
  LIMIT 1;
$$;

