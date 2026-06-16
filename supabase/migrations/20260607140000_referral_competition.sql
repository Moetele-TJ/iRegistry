-- Referral competition: opt-in agent numbers, signup attribution, admin toggle.

CREATE SEQUENCE IF NOT EXISTS public.referral_agent_number_seq
  START WITH 1001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.normalize_agent_number(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  compact text;
  digits text;
  num int;
BEGIN
  IF p_raw IS NULL OR trim(p_raw) = '' THEN
    RETURN NULL;
  END IF;

  compact := upper(regexp_replace(trim(p_raw), '[\s\-]+', '', 'g'));

  IF compact !~ '^IR[0-9]+$' THEN
    RETURN NULL;
  END IF;

  digits := regexp_replace(compact, '^IR', '');
  num := digits::int;

  IF num < 1001 THEN
    RETURN NULL;
  END IF;

  RETURN 'IR-' || num::text;
END;
$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS agent_number text NULL,
  ADD COLUMN IF NOT EXISTS agent_number_assigned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS referred_by_agent_number text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_agent_number_unique_idx
  ON public.users (agent_number)
  WHERE agent_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_referred_by_user_id_idx
  ON public.users (referred_by_user_id)
  WHERE referred_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_competition_config (
  id integer PRIMARY KEY CHECK (id = 1),
  signup_button_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id)
);

INSERT INTO public.referral_competition_config (id, signup_button_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_referral_competition_config_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_competition_config_updated_at ON public.referral_competition_config;
CREATE TRIGGER trg_referral_competition_config_updated_at
BEFORE UPDATE ON public.referral_competition_config
FOR EACH ROW
EXECUTE FUNCTION public.set_referral_competition_config_updated_at();

ALTER TABLE public.referral_competition_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assign_agent_number_to_user(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing text;
  next_num bigint;
  canonical text;
BEGIN
  SELECT agent_number INTO existing
  FROM public.users
  WHERE id = p_user_id;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  next_num := nextval('public.referral_agent_number_seq');
  canonical := 'IR-' || next_num::text;

  UPDATE public.users
  SET
    agent_number = canonical,
    agent_number_assigned_at = now()
  WHERE id = p_user_id
    AND agent_number IS NULL
  RETURNING agent_number INTO existing;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  SELECT agent_number INTO existing
  FROM public.users
  WHERE id = p_user_id;

  RETURN existing;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_agent_number_to_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_agent_number_to_user(uuid) TO service_role;

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
      AND EXISTS (
        SELECT 1
        FROM public.promo_campaigns pc
        WHERE pc.scope = 'system'
          AND u.created_at >= pc.starts_at
          AND u.created_at < public.promo_effective_end(pc.proposed_ends_at, pc.ended_at)
      )
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

REVOKE ALL ON FUNCTION public.referral_counts_for_agent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_counts_for_agent(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.referral_competition_leaderboard()
RETURNS TABLE (
  user_id uuid,
  agent_number text,
  first_name text,
  last_name text,
  email text,
  signup_count bigint,
  qualified_count bigint,
  agent_number_assigned_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agents AS (
    SELECT
      u.id,
      u.agent_number,
      u.first_name,
      u.last_name,
      u.email,
      u.agent_number_assigned_at
    FROM public.users u
    WHERE u.agent_number IS NOT NULL
      AND u.deleted_at IS NULL
      AND u.suspended_at IS NULL
      AND u.disabled_at IS NULL
  ),
  counts AS (
    SELECT
      a.id AS agent_id,
      c.signup_count,
      c.qualified_count
    FROM agents a
    CROSS JOIN LATERAL public.referral_counts_for_agent(a.id) c
  )
  SELECT
    a.id AS user_id,
    a.agent_number,
    a.first_name,
    a.last_name,
    a.email,
    COALESCE(c.signup_count, 0) AS signup_count,
    COALESCE(c.qualified_count, 0) AS qualified_count,
    a.agent_number_assigned_at
  FROM agents a
  LEFT JOIN counts c ON c.agent_id = a.id
  ORDER BY
    COALESCE(c.signup_count, 0) DESC,
    COALESCE(c.qualified_count, 0) DESC,
    a.agent_number_assigned_at ASC NULLS LAST,
    a.agent_number ASC;
$$;

REVOKE ALL ON FUNCTION public.referral_competition_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_competition_leaderboard() TO service_role;
