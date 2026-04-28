-- Keep a history of system promo config changes (last N shown in UI).

CREATE TABLE IF NOT EXISTS public.system_promo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  note text NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_system_promo_history_changed_at
  ON public.system_promo_history (changed_at DESC);

-- Insert a history row after each update to the single config row.
CREATE OR REPLACE FUNCTION public.log_system_promo_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.system_promo_history (
    enabled,
    starts_at,
    ends_at,
    note,
    changed_at,
    changed_by
  )
  VALUES (
    NEW.enabled,
    NEW.starts_at,
    NEW.ends_at,
    NEW.note,
    now(),
    NEW.updated_by
  );

  -- Keep the table bounded (retain newest 50; UI shows last 5).
  DELETE FROM public.system_promo_history h
  WHERE h.id NOT IN (
    SELECT id
    FROM public.system_promo_history
    ORDER BY changed_at DESC
    LIMIT 50
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_promo_history ON public.system_promo_config;
CREATE TRIGGER trg_system_promo_history
AFTER UPDATE ON public.system_promo_config
FOR EACH ROW
EXECUTE FUNCTION public.log_system_promo_history();

