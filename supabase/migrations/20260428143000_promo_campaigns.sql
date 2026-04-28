-- Promo campaigns (system-wide and per-user) with proposed + actual end.
-- Replaces: system_promo_config/system_promo_history + user_promo_enrollments (kept for backward compat).
--
-- Rules:
-- - Each promo is a row.
-- - Status is derived from time:
--   - Active when now() in [starts_at, effective_ends_at) where effective_ends_at = least(proposed_ends_at, ended_at if set).
-- - Only one active campaign at a time for:
--   - scope='system' (global)
--   - each user_id for scope='user'

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.promo_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('system','user')),
  user_id uuid NULL REFERENCES public.users(id) ON DELETE CASCADE,

  starts_at timestamptz NOT NULL,
  proposed_ends_at timestamptz NOT NULL,
  ended_at timestamptz NULL,

  note text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id)
);

ALTER TABLE public.promo_campaigns
  ADD CONSTRAINT promo_campaigns_user_scope_check
  CHECK (
    (scope = 'system' AND user_id IS NULL)
    OR (scope = 'user' AND user_id IS NOT NULL)
  );

ALTER TABLE public.promo_campaigns
  ADD CONSTRAINT promo_campaigns_date_order_check
  CHECK (
    starts_at < proposed_ends_at
    AND (ended_at IS NULL OR ended_at >= starts_at)
  );

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_promo_campaigns_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promo_campaigns_updated_at ON public.promo_campaigns;
CREATE TRIGGER trg_promo_campaigns_updated_at
BEFORE UPDATE ON public.promo_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.set_promo_campaigns_updated_at();

-- Effective end used for overlap prevention + active checks
CREATE OR REPLACE FUNCTION public.promo_effective_end(p_proposed timestamptz, p_ended timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_ended IS NULL THEN p_proposed
    WHEN p_ended < p_proposed THEN p_ended
    ELSE p_proposed
  END;
$$;

-- Prevent overlapping system promos (regardless of "active", overlap implies >1 could be active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promo_campaigns_no_overlap_system'
  ) THEN
    ALTER TABLE public.promo_campaigns
      ADD CONSTRAINT promo_campaigns_no_overlap_system
      EXCLUDE USING gist (
        tstzrange(starts_at, public.promo_effective_end(proposed_ends_at, ended_at), '[)') WITH &&
      )
      WHERE (scope = 'system');
  END IF;
END $$;

-- Prevent overlapping promos per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promo_campaigns_no_overlap_user'
  ) THEN
    ALTER TABLE public.promo_campaigns
      ADD CONSTRAINT promo_campaigns_no_overlap_user
      EXCLUDE USING gist (
        user_id WITH =,
        tstzrange(starts_at, public.promo_effective_end(proposed_ends_at, ended_at), '[)') WITH &&
      )
      WHERE (scope = 'user');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promo_campaigns_scope_created_at
  ON public.promo_campaigns (scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_campaigns_user_created_at
  ON public.promo_campaigns (user_id, created_at DESC);

-- -----------------------------
-- Promo helper functions (campaign-based)
-- -----------------------------
CREATE OR REPLACE FUNCTION public.is_system_promo_active()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.promo_campaigns c
    WHERE c.scope = 'system'
      AND now() >= c.starts_at
      AND now() < public.promo_effective_end(c.proposed_ends_at, c.ended_at)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_promo_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.promo_campaigns c
    WHERE c.scope = 'user'
      AND c.user_id = p_user_id
      AND now() >= c.starts_at
      AND now() < public.promo_effective_end(c.proposed_ends_at, c.ended_at)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_promo_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_system_promo_active()
     OR (p_user_id IS NOT NULL AND public.is_user_promo_active(p_user_id));
$$;

