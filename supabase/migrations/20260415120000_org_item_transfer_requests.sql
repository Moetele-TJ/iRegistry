-- Organization item transfer requests:
-- Org Admin can request to transfer an org-owned item to a personal owner (user),
-- with reason + evidence. Staff (admin/cashier) can review and complete.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_item_transfer_request_status') THEN
    CREATE TYPE public.org_item_transfer_request_status AS ENUM ('OPEN', 'COMPLETED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.org_item_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  evidence jsonb NULL,
  status public.org_item_transfer_request_status NOT NULL DEFAULT 'OPEN',
  requested_by uuid NOT NULL REFERENCES public.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL REFERENCES public.users(id),
  reviewed_at timestamptz NULL,
  review_note text NULL,
  completed_at timestamptz NULL,
  UNIQUE (org_id, item_id, status) DEFERRABLE INITIALLY IMMEDIATE
);

-- Only allow one OPEN request per item (but allow history).
DROP INDEX IF EXISTS public.org_item_transfer_requests_one_open_per_item_idx;
CREATE UNIQUE INDEX org_item_transfer_requests_one_open_per_item_idx
  ON public.org_item_transfer_requests (item_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS org_item_transfer_requests_org_status_created_idx
  ON public.org_item_transfer_requests (org_id, status, requested_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_item_transfer_requests TO service_role;

