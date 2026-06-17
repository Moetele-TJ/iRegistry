-- Separate referral competition status from free-registration promotions.
-- Competition window currently follows the system promo schedule; decouple later via config dates.

ALTER TABLE public.referral_competition_config
  ADD COLUMN IF NOT EXISTS competition_enabled boolean NOT NULL DEFAULT false;

UPDATE public.referral_competition_config
SET competition_enabled = signup_button_enabled
WHERE id = 1;

COMMENT ON COLUMN public.referral_competition_config.competition_enabled IS
  'Admin master switch for the referral competition. Window timing is computed separately.';

CREATE OR REPLACE FUNCTION public.is_referral_competition_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.competition_enabled
      FROM public.referral_competition_config c
      WHERE c.id = 1
    ),
    false
  )
  -- For now the competition window tracks the free-registration system promo.
  -- Replace with competition-specific dates on referral_competition_config when needed.
  AND public.is_system_promo_active();
$$;

REVOKE ALL ON FUNCTION public.is_referral_competition_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_referral_competition_active() TO service_role;

CREATE OR REPLACE FUNCTION public.referral_competition_signup_counts_at(p_created_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Signup scoring window: currently aligned with system promo campaigns.
  -- Swap to competition-specific bounds when the competition outlives a single promo.
  SELECT EXISTS (
    SELECT 1
    FROM public.promo_campaigns pc
    WHERE pc.scope = 'system'
      AND p_created_at >= pc.starts_at
      AND p_created_at < public.promo_effective_end(pc.proposed_ends_at, pc.ended_at)
  );
$$;

CREATE OR REPLACE FUNCTION public.referral_counts_for_agent(p_agent_user_id uuid)
RETURNS TABLE (
  signup_count bigint,
  qualified_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH referred AS (
    SELECT u.id AS referred_id
    FROM public.users u
    WHERE u.referred_by_user_id = p_agent_user_id
      AND u.deleted_at IS NULL
      AND u.suspended_at IS NULL
      AND u.disabled_at IS NULL
      AND public.referral_competition_signup_counts_at(u.created_at)
  ),
  item_counts AS (
    SELECT i.ownerid AS owner_id, count(*)::bigint AS cnt
    FROM public.items i
    WHERE i.deletedat IS NULL
      AND i.legacyat IS NULL
    GROUP BY i.ownerid
  )
  SELECT
    (SELECT count(*)::bigint FROM referred) AS signup_count,
    (
      SELECT count(*)::bigint
      FROM referred r
      JOIN item_counts ic ON ic.owner_id = r.referred_id
      WHERE ic.cnt >= 2
    ) AS qualified_count;
$$;
