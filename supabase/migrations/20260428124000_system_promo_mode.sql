-- System-wide promo mode + per-user promo enrollments
-- - Allows admin to enable promo for the whole system or specific users
-- - Billing RPCs (spend_credits / spend_org_credits) bypass charges when promo is active

-- -----------------------------
-- 1) System promo config (single row)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.system_promo_config (
  id integer PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  note text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id)
);

INSERT INTO public.system_promo_config (id, enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_system_promo_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_promo_config_updated_at ON public.system_promo_config;
CREATE TRIGGER trg_system_promo_config_updated_at
BEFORE UPDATE ON public.system_promo_config
FOR EACH ROW
EXECUTE FUNCTION public.set_system_promo_updated_at();

-- -----------------------------
-- 2) Per-user promo enrollments
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.user_promo_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_promo_enrollments_user_active
  ON public.user_promo_enrollments (user_id, starts_at, ends_at);

CREATE OR REPLACE FUNCTION public.set_user_promo_enrollments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_promo_enrollments_updated_at ON public.user_promo_enrollments;
CREATE TRIGGER trg_user_promo_enrollments_updated_at
BEFORE UPDATE ON public.user_promo_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.set_user_promo_enrollments_updated_at();

-- -----------------------------
-- 3) Promo check helpers
-- -----------------------------
CREATE OR REPLACE FUNCTION public.is_system_promo_active()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.enabled
    AND (c.starts_at IS NULL OR now() >= c.starts_at)
    AND (c.ends_at IS NULL OR now() <= c.ends_at)
  FROM public.system_promo_config c
  WHERE c.id = 1;
$$;

CREATE OR REPLACE FUNCTION public.is_user_promo_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_promo_enrollments e
    WHERE e.user_id = p_user_id
      AND now() >= e.starts_at
      AND (e.ends_at IS NULL OR now() <= e.ends_at)
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

-- -----------------------------
-- 4) Patch billing RPCs to respect promo
-- -----------------------------
-- spend_credits: bypass charges during promo (system or user enrollment)
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id uuid,
  p_task_code text,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost integer;
  v_balance integer;
BEGIN
  IF p_user_id IS NULL OR p_task_code IS NULL THEN
    RETURN QUERY SELECT false, NULL::integer, 'Invalid payload';
    RETURN;
  END IF;

  -- Promo bypass
  IF public.is_promo_active(p_user_id) THEN
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance INTO v_balance
    FROM public.user_credits
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT true, v_balance, 'PROMO_BYPASS';
    RETURN;
  END IF;

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
$$;

-- spend_org_credits: bypass org debits during promo (system or actor enrollment)
CREATE OR REPLACE FUNCTION public.spend_org_credits (
  p_org_id uuid,
  p_task_code text,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE (success boolean, new_balance integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost integer;
  v_balance integer;
BEGIN
  IF p_org_id IS NULL OR p_task_code IS NULL THEN
    success := false;
    new_balance := NULL;
    message := 'INVALID_PAYLOAD';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Promo bypass (system promo or actor enrolled)
  IF public.is_system_promo_active() OR (p_created_by IS NOT NULL AND public.is_user_promo_active(p_created_by)) THEN
    INSERT INTO public.org_credits (org_id, balance)
    VALUES (p_org_id, 0)
    ON CONFLICT (org_id) DO NOTHING;

    SELECT balance INTO v_balance
    FROM public.org_credits
    WHERE org_id = p_org_id;

    success := true;
    new_balance := v_balance;
    message := 'PROMO_BYPASS';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT credits_cost INTO v_cost
  FROM public.task_catalog
  WHERE code = p_task_code AND active = true;

  IF v_cost IS NULL THEN
    success := false;
    new_balance := NULL;
    message := 'TASK_NOT_FOUND';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Ensure org_credits row exists (even for 0-cost tasks).
  INSERT INTO public.org_credits (org_id, balance)
  VALUES (p_org_id, 0)
  ON CONFLICT (org_id) DO NOTHING;

  -- Zero-cost tasks are allowed, but still create a ledger row for audit.
  IF v_cost = 0 THEN
    INSERT INTO public.org_credit_ledger (
      org_id,
      entry_type,
      amount,
      task_code,
      reference,
      metadata,
      created_by
    )
    VALUES (
      p_org_id,
      'CREDIT_SPEND',
      0,
      p_task_code,
      p_reference,
      p_metadata,
      p_created_by
    );

    success := true;
    new_balance := (SELECT balance FROM public.org_credits WHERE org_id = p_org_id);
    message := 'OK';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT balance INTO v_balance
  FROM public.org_credits
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF v_balance < v_cost THEN
    success := false;
    new_balance := v_balance;
    message := 'INSUFFICIENT_CREDITS';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.org_credits
  SET balance = balance - v_cost
  WHERE org_id = p_org_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.org_credit_ledger (
    org_id,
    entry_type,
    amount,
    task_code,
    reference,
    metadata,
    created_by
  )
  VALUES (
    p_org_id,
    'CREDIT_SPEND',
    v_cost,
    p_task_code,
    p_reference,
    p_metadata,
    p_created_by
  );

  success := true;
  new_balance := v_balance;
  message := 'OK';
  RETURN NEXT;
END;
$$;

