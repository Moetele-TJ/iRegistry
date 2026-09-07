-- Human-readable profile URL slugs for users (surname-names).
-- Soft-delete vacates the bare slug by appending -1, -2, … so an active account can keep the original.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS slug text;

COMMENT ON COLUMN public.users.slug IS
  'URL segment for staff profile ?user=…; surname-firstname. Soft-deleted rows use -N suffixes.';

-- Backfill unique slugs: earliest accounts prefer the bare base.
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT
      id,
      coalesce(nullif(trim(last_name), ''), '') AS ln,
      coalesce(nullif(trim(first_name), ''), '') AS fn
    FROM public.users
    WHERE slug IS NULL OR btrim(slug) = ''
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    base := trim(both '-' FROM lower(regexp_replace(
      nullif(trim(both '-' FROM concat_ws('-',
        nullif(trim(r.ln), ''),
        nullif(trim(r.fn), '')
      )), ''),
      '[^a-z0-9]+',
      '-',
      'g'
    )));
    IF base IS NULL OR base = '' THEN
      base := 'user';
    END IF;

    candidate := base;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.users u WHERE lower(u.slug) = lower(candidate)
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n::text;
    END LOOP;

    UPDATE public.users SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.users
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_slug_uidx ON public.users (lower(slug));
