-- Credits + billing foundation
-- - task_catalog: defines credit cost per task
-- - user_credits + credit_ledger: balance + audit trail
-- - payments: records top-ups (cashier/online)
-- - items.created_by: enforce lifetime "2 free registrations" rule
-- - request_attempts: already used by verify-item rate limiting (IP-based)

-- -----------------------------
-- 1) Request attempts (rate limit logs)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.request_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_attempts_ip_action_created_at
  ON public.request_attempts (ip, action, created_at DESC);

-- -----------------------------
-- 2) Catalog of billable tasks
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.task_catalog (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  credits_cost integer NOT NULL CHECK (credits_cost >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_catalog_updated_at ON public.task_catalog;
CREATE TRIGGER trg_task_catalog_updated_at
BEFORE UPDATE ON public.task_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed tasks (can be edited later)
INSERT INTO public.task_catalog (code, name, description, credits_cost, active)
VALUES
  ('ADD_ITEM', 'Add item', 'Register a new item', 2, true),
  ('TRANSFER_OWNERSHIP', 'Transfer ownership', 'Complete transfer of an item to another user', 4, true),
  ('REQUEST_TRANSFER', 'Request transfer', 'Request the current owner to transfer an item to you', 1, true),
  ('REVIEW_TRANSFER_REQUEST', 'Review transfer request', 'Approve/decline a pending transfer request', 0, true),
  ('MARK_STOLEN', 'Mark stolen', 'Report an item as stolen (opens a police case)', 3, true),
  ('RESTORE_ITEM', 'Restore item', 'Restore a deleted item', 3, true),
  ('EDIT_ITEM', 'Edit item', 'Edit an item’s details', 1, true),
  ('UPLOAD_PHOTOS', 'Upload photos', 'Upload new photos for an item', 1, true),
  ('DOWNLOAD_CERTIFICATE', 'Download certificate', 'Download an ownership/registration certificate', 1, true),
  ('VERIFY_ITEM_SERIAL', 'Verify serial', 'Verify an item by serial number (paid after free limit)', 1, true),
  ('NOTIFY_OWNER', 'Notify owner', 'Send a message to the registered owner (paid after free limit)', 1, true)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------
-- 3) Credits state + ledger
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('CREDIT_ADD','CREDIT_SPEND','ADJUSTMENT','REFUND')),
  amount integer NOT NULL CHECK (amount > 0),
  task_code text NULL REFERENCES public.task_catalog(code),
  reference text NULL,
  metadata jsonb NULL,
  created_by uuid NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created_at
  ON public.credit_ledger (user_id, created_at DESC);

-- Auto-create user_credits row when a user is created
CREATE OR REPLACE FUNCTION public.ensure_user_credits()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_create_credits ON public.users;
CREATE TRIGGER trg_users_create_credits
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_credits();

-- Helper: spend credits atomically
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id uuid,
  p_task_code text,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text) AS $$
DECLARE
  v_cost integer;
  v_balance integer;
BEGIN
  SELECT credits_cost INTO v_cost
  FROM public.task_catalog
  WHERE code = p_task_code AND active = true;

  IF v_cost IS NULL THEN
    RETURN QUERY SELECT false, NULL::integer, 'Unknown or inactive task';
    RETURN;
  END IF;

  -- lock row for atomic spend
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance < v_cost THEN
    RETURN QUERY SELECT false, v_balance, 'Insufficient credits';
    RETURN;
  END IF;

  UPDATE public.user_credits
  SET balance = balance - v_cost, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (user_id, entry_type, amount, task_code, reference, metadata)
  VALUES (p_user_id, 'CREDIT_SPEND', v_cost, p_task_code, p_reference, p_metadata);

  RETURN QUERY SELECT true, v_balance, 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: add credits atomically
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text) AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN QUERY SELECT false, NULL::integer, 'Invalid amount';
    RETURN;
  END IF;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_credits
  SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (user_id, entry_type, amount, task_code, reference, metadata, created_by)
  VALUES (p_user_id, 'CREDIT_ADD', p_amount, NULL, p_reference, p_metadata, p_created_by);

  RETURN QUERY SELECT true, v_balance, 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------
-- 4) Payments
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('ONLINE','CASHIER')),
  status text NOT NULL CHECK (status IN ('PENDING','CONFIRMED','FAILED','CANCELLED')),
  currency text NOT NULL DEFAULT 'BWP',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  credits_granted integer NOT NULL DEFAULT 0 CHECK (credits_granted >= 0),
  provider text NULL,
  provider_reference text NULL,
  cashier_user_id uuid NULL REFERENCES public.users(id),
  receipt_no text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created_at
  ON public.payments (user_id, created_at DESC);

-- -----------------------------
-- 5) Items lifetime creation marker
-- -----------------------------
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES public.users(id);

-- Backfill for existing items: assume creator == current owner
UPDATE public.items
SET created_by = ownerid
WHERE created_by IS NULL AND ownerid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_created_by
  ON public.items (created_by);

