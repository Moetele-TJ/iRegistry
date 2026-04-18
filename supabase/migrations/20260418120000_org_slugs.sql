-- Human-readable URL slugs for organizations (unique; API still uses org id).

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: lowercase name slug + short id suffix (unique per row).
UPDATE public.orgs o
SET slug = trim(both '-' FROM lower(regexp_replace(coalesce(nullif(trim(o.name), ''), 'organization'), '[^a-z0-9]+', '-', 'g')))
  || '-' || substring(replace(o.id::text, '-', ''), 1, 8)
WHERE o.slug IS NULL OR btrim(o.slug) = '';

ALTER TABLE public.orgs
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug_idx ON public.orgs (slug);

COMMENT ON COLUMN public.orgs.slug IS 'URL segment for /organizations/:slug/...; APIs use org uuid.';
