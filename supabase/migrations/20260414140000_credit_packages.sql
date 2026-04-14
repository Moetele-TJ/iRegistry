-- -----------------------------------------------------------------------------
-- Credit packages (top-up products)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.credit_packages (
  id text PRIMARY KEY,
  currency text NOT NULL DEFAULT 'BWP',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  credits integer NOT NULL CHECK (credits > 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_packages_active_sort_idx
  ON public.credit_packages (active desc, sort_order asc, amount asc);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS trg_credit_packages_updated_at ON public.credit_packages;
CREATE TRIGGER trg_credit_packages_updated_at
BEFORE UPDATE ON public.credit_packages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults (id format matches existing hardcoded constants)
INSERT INTO public.credit_packages (id, currency, amount, credits, active, sort_order)
VALUES
  ('BWP_30', 'BWP', 30.00, 10, true, 10),
  ('BWP_50', 'BWP', 50.00, 20, true, 20),
  ('BWP_100', 'BWP', 100.00, 50, true, 30)
ON CONFLICT (id) DO NOTHING;

-- service_role is used by edge functions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_packages TO service_role;

