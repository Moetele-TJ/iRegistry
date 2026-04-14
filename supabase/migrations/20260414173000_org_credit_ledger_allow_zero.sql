-- Allow 0-cost ledger entries for org spend (audit).
-- The org ledger currently enforces amount > 0, but some tasks can be free (0 credits).

DO $$
BEGIN
  -- Default name for inline CHECK is usually <table>_<col>_check
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_credit_ledger_amount_check'
  ) THEN
    ALTER TABLE public.org_credit_ledger
      DROP CONSTRAINT org_credit_ledger_amount_check;
  END IF;
END $$;

ALTER TABLE public.org_credit_ledger
  ADD CONSTRAINT org_credit_ledger_amount_check CHECK (amount >= 0);

