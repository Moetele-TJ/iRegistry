-- Decouple referral competition from free-registration promo.
-- Competition has its own campaign calendar (start / proposed end / early end),
-- history rows, and independent live status.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.referral_competition_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL,
  proposed_ends_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT referral_competition_campaigns_date_order_check CHECK (
    starts_at < proposed_ends_at
    AND (ended_at IS NULL OR ended_at >= starts_at)
  )
);

CREATE OR REPLACE FUNCTION public.set_referral_competition_campaigns_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_competition_campaigns_updated_at
  ON public.referral_competition_campaigns;
CREATE TRIGGER trg_referral_competition_campaigns_updated_at
BEFORE UPDATE ON public.referral_competition_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.set_referral_competition_campaigns_updated_at();

-- Effective end (same semantics as promo_effective_end)
CREATE OR REPLACE FUNCTION public.competition_effective_end(
  p_proposed timestamptz,
  p_ended timestamptz
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.promo_effective_end(p_proposed, p_ended);
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_competition_campaigns_no_overlap'
  ) THEN
    ALTER TABLE public.referral_competition_campaigns
      ADD CONSTRAINT referral_competition_campaigns_no_overlap
      EXCLUDE USING gist (
        tstzrange(
          starts_at,
          public.competition_effective_end(proposed_ends_at, ended_at),
          '[)'
        ) WITH &&
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_competition_campaigns_created_at
  ON public.referral_competition_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_competition_campaigns_window
  ON public.referral_competition_campaigns (starts_at, proposed_ends_at);

ALTER TABLE public.referral_competition_campaigns ENABLE ROW LEVEL SECURITY;

-- Live = there is a competition campaign currently in window (no promo dependency).
CREATE OR REPLACE FUNCTION public.is_referral_competition_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.referral_competition_campaigns c
    WHERE now() >= c.starts_at
      AND now() < public.competition_effective_end(c.proposed_ends_at, c.ended_at)
  );
$$;

REVOKE ALL ON FUNCTION public.is_referral_competition_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_referral_competition_active() TO service_role;

-- Scoring window: referral signups count only inside competition campaigns.
CREATE OR REPLACE FUNCTION public.referral_competition_signup_counts_at(p_created_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.referral_competition_campaigns c
    WHERE p_created_at >= c.starts_at
      AND p_created_at < public.competition_effective_end(c.proposed_ends_at, c.ended_at)
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

-- Grace period timing: latest competition campaign end (not system promo).
CREATE OR REPLACE FUNCTION public.referral_competition_latest_campaign_end()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.competition_effective_end(c.proposed_ends_at, c.ended_at)
  FROM public.referral_competition_campaigns c
  ORDER BY public.competition_effective_end(c.proposed_ends_at, c.ended_at) DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.referral_competition_latest_campaign_end() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_competition_latest_campaign_end() TO service_role;

-- Keep old helper name for any callers; point at competition calendar.
CREATE OR REPLACE FUNCTION public.referral_competition_latest_system_promo_end()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.referral_competition_latest_campaign_end();
$$;

-- Keep config flags in sync with campaign live status (claim / session UI).
CREATE OR REPLACE FUNCTION public.sync_referral_competition_config_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  live boolean;
  latest_end timestamptz;
BEGIN
  live := public.is_referral_competition_active();
  latest_end := public.referral_competition_latest_campaign_end();

  UPDATE public.referral_competition_config
  SET
    competition_enabled = live,
    signup_button_enabled = live,
    competition_last_ended_at = CASE
      WHEN live THEN NULL
      WHEN competition_last_ended_at IS NOT NULL THEN competition_last_ended_at
      ELSE COALESCE(latest_end, now())
    END,
    leaderboard_override_visible = CASE
      WHEN live THEN false
      ELSE leaderboard_override_visible
    END,
    updated_at = now()
  WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_referral_competition_config_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_referral_competition_config_flags() TO service_role;

CREATE OR REPLACE FUNCTION public.trg_referral_competition_campaigns_sync_flags()
RETURNS trigger AS $$
BEGIN
  PERFORM public.sync_referral_competition_config_flags();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_competition_campaigns_aiud
  ON public.referral_competition_campaigns;
CREATE TRIGGER trg_referral_competition_campaigns_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.referral_competition_campaigns
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_referral_competition_campaigns_sync_flags();

COMMENT ON TABLE public.referral_competition_campaigns IS
  'Independent referral competition windows. Completely separate from promo_campaigns / free registration.';

COMMENT ON COLUMN public.referral_competition_config.competition_enabled IS
  'Derived from an active referral_competition_campaigns row; kept for claim/session compatibility.';

-- One-shot sync so flags match current campaigns (none yet → off).
SELECT public.sync_referral_competition_config_flags();
