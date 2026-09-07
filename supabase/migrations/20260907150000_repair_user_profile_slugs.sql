-- Repair profile slugs that were generated with lower() AFTER [^a-z0-9] stripping.
-- That backfill dropped Title Case letters (Kenanao → enanao → lesobela-enanao).
-- Recompute surname-firstname slugs the same way as shared/userSlug.ts.

DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  -- Free existing values so we can reassign without unique collisions mid-loop.
  UPDATE public.users
  SET slug = 'tmp-' || replace(id::text, '-', '')
  WHERE slug IS NOT NULL;

  FOR r IN
    SELECT
      id,
      coalesce(nullif(trim(last_name), ''), '') AS ln,
      coalesce(nullif(trim(first_name), ''), '') AS fn
    FROM public.users
    ORDER BY created_at ASC NULLS LAST, id ASC
  LOOP
    base := trim(both '-' FROM regexp_replace(
      regexp_replace(
        lower(trim(both '-' FROM concat_ws('-',
          nullif(trim(r.ln), ''),
          nullif(trim(r.fn), '')
        ))),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-+',
      '-',
      'g'
    ));
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
