-- Leaderboard visibility: live during competition, 7 days after it ends, or admin override.

ALTER TABLE public.referral_competition_config
  ADD COLUMN IF NOT EXISTS competition_last_ended_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS leaderboard_override_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.referral_competition_config.competition_last_ended_at IS
  'When the competition window last closed; staff leaderboard stays up for 7 days after this timestamp.';

COMMENT ON COLUMN public.referral_competition_config.leaderboard_override_visible IS
  'Admin on-demand: show the staff leaderboard after the post-competition grace period.';

CREATE OR REPLACE FUNCTION public.referral_competition_latest_system_promo_end()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.promo_effective_end(pc.proposed_ends_at, pc.ended_at)
  FROM public.promo_campaigns pc
  WHERE pc.scope = 'system'
  ORDER BY public.promo_effective_end(pc.proposed_ends_at, pc.ended_at) DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.referral_competition_latest_system_promo_end() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_competition_latest_system_promo_end() TO service_role;

CREATE OR REPLACE FUNCTION public.is_referral_leaderboard_visible()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (
        SELECT c.leaderboard_override_visible
        FROM public.referral_competition_config c
        WHERE c.id = 1
      ),
      false
    )
    OR public.is_referral_competition_active()
    OR EXISTS (
      SELECT 1
      FROM public.referral_competition_config c
      WHERE c.id = 1
        AND c.competition_last_ended_at IS NOT NULL
        AND now() < c.competition_last_ended_at + interval '7 days'
    );
$$;

REVOKE ALL ON FUNCTION public.is_referral_leaderboard_visible() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_referral_leaderboard_visible() TO service_role;

CREATE OR REPLACE FUNCTION public.referral_leaderboard_visible_until()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_referral_competition_active() THEN NULL
    WHEN COALESCE(
      (SELECT c.leaderboard_override_visible FROM public.referral_competition_config c WHERE c.id = 1),
      false
    ) THEN NULL
  ELSE (
    SELECT c.competition_last_ended_at + interval '7 days'
    FROM public.referral_competition_config c
    WHERE c.id = 1
      AND c.competition_last_ended_at IS NOT NULL
  )
  END;
$$;

REVOKE ALL ON FUNCTION public.referral_leaderboard_visible_until() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_leaderboard_visible_until() TO service_role;
