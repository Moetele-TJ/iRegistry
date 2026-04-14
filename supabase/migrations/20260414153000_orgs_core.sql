-- -----------------------------------------------------------------------------
-- Orgs (corporate) core schema
-- - Orgs + membership (invite/accept/reject)
-- - Org-owned item fields + assignment
-- - Org wallet (credits) + ledger
-- - Return requests (member -> manager/admin)
-- - Org item activity log (flexible)
-- -----------------------------------------------------------------------------

-- -----------------------------
-- 1) Orgs
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_no text NULL,
  contact_email text NULL,
  phone text NULL,
  village text NULL,
  ward text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orgs_name_idx ON public.orgs (name);

DROP TRIGGER IF EXISTS trg_orgs_updated_at ON public.orgs;
CREATE TRIGGER trg_orgs_updated_at
BEFORE UPDATE ON public.orgs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgs TO service_role;

-- -----------------------------
-- 2) Org membership
-- -----------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE public.org_role AS ENUM ('ORG_ADMIN', 'ORG_MANAGER', 'ORG_MEMBER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_membership_status') THEN
    CREATE TYPE public.org_membership_status AS ENUM ('INVITED', 'ACTIVE', 'REJECTED', 'REMOVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'ORG_MEMBER',
  status public.org_membership_status NOT NULL DEFAULT 'INVITED',
  invited_by uuid NULL REFERENCES public.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_idx ON public.org_members (user_id, status);
CREATE INDEX IF NOT EXISTS org_members_org_idx ON public.org_members (org_id, status, role);

DROP TRIGGER IF EXISTS trg_org_members_updated_at ON public.org_members;
CREATE TRIGGER trg_org_members_updated_at
BEFORE UPDATE ON public.org_members
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO service_role;

-- -----------------------------
-- 3) Org-owned items + assignment
-- -----------------------------
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS owner_org_id uuid NULL REFERENCES public.orgs(id),
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS org_assigned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS org_assigned_by uuid NULL REFERENCES public.users(id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS items_owner_org_idx ON public.items (owner_org_id);
CREATE INDEX IF NOT EXISTS items_assigned_user_idx ON public.items (assigned_user_id);
CREATE INDEX IF NOT EXISTS items_org_unassigned_idx
  ON public.items (owner_org_id)
  WHERE owner_org_id IS NOT NULL AND assigned_user_id IS NULL AND deletedat IS NULL AND legacyat IS NULL;

-- -----------------------------
-- 4) Org credits + ledger
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.org_credits (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_org_credits_updated_at ON public.org_credits;
CREATE TRIGGER trg_org_credits_updated_at
BEFORE UPDATE ON public.org_credits
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.org_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('CREDIT_ADD','CREDIT_SPEND','ADJUSTMENT','REFUND')),
  amount integer NOT NULL CHECK (amount > 0),
  task_code text NULL REFERENCES public.task_catalog(code),
  reference text NULL,
  metadata jsonb NULL,
  created_by uuid NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_credit_ledger_org_created_at
  ON public.org_credit_ledger (org_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_credits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_credit_ledger TO service_role;

-- -----------------------------
-- 5) Return requests (member -> org manager/admin)
-- -----------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_return_request_status') THEN
    CREATE TYPE public.org_return_request_status AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.org_item_return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.org_return_request_status NOT NULL DEFAULT 'OPEN',
  requester_note text NULL,
  reviewer_user_id uuid NULL REFERENCES public.users(id),
  reviewer_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL,
  -- Only one OPEN request per item.
  -- (Cannot be expressed as a standard UNIQUE constraint with a WHERE clause.)
  -- Use the partial unique index below.
  CONSTRAINT org_item_return_requests_status_check CHECK (status IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS org_item_return_requests_org_status_idx
  ON public.org_item_return_requests (org_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS org_item_return_requests_one_open_per_item_idx
  ON public.org_item_return_requests (item_id)
  WHERE status = 'OPEN';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_item_return_requests TO service_role;

-- -----------------------------
-- 6) Org item activity log (flexible)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.org_item_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id uuid NULL REFERENCES public.items(id) ON DELETE SET NULL,
  actor_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  message text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_item_activity_org_created_at_idx
  ON public.org_item_activity_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS org_item_activity_item_created_at_idx
  ON public.org_item_activity_logs (item_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_item_activity_logs TO service_role;

