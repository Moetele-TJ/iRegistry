-- Split "location" semantics into:
-- - users: village, ward (residence)
-- - items: village, ward (where item resides) + station (nearest police station)
--
-- Backwards compatibility:
-- - Keep existing columns (`users.city`, `users.address_line`, `items.location`) for now.
-- - Backfill new columns from the old fields where possible.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS village text NULL,
  ADD COLUMN IF NOT EXISTS ward text NULL;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS village text NULL,
  ADD COLUMN IF NOT EXISTS ward text NULL,
  ADD COLUMN IF NOT EXISTS station text NULL;

-- Backfill users: treat previous city/address_line as village/ward.
UPDATE public.users
SET
  village = COALESCE(NULLIF(TRIM(village), ''), NULLIF(TRIM(city), '')),
  ward    = COALESCE(NULLIF(TRIM(ward), ''), NULLIF(TRIM(address_line), ''))
WHERE
  (village IS NULL OR TRIM(village) = '' OR ward IS NULL OR TRIM(ward) = '');

-- Backfill items: previous items.location was used as "nearest police station".
UPDATE public.items
SET
  station = COALESCE(NULLIF(TRIM(station), ''), NULLIF(TRIM(location), ''))
WHERE
  (station IS NULL OR TRIM(station) = '');

-- Helpful indexes for dropdowns/filters.
CREATE INDEX IF NOT EXISTS idx_users_village ON public.users USING btree (village);
CREATE INDEX IF NOT EXISTS idx_users_ward ON public.users USING btree (ward);

CREATE INDEX IF NOT EXISTS idx_items_village ON public.items USING btree (village);
CREATE INDEX IF NOT EXISTS idx_items_ward ON public.items USING btree (ward);
CREATE INDEX IF NOT EXISTS idx_items_station ON public.items USING btree (station);

