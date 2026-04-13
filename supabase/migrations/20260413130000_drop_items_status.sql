-- Stage B: remove legacy stored item status column.
-- Item state is derived from:
-- - deletedat (deleted)
-- - legacyat (legacy/obsolete)
-- - reportedstolenat (stolen)

alter table public.items
  drop column if exists status;

-- Support derived queries / counts for stolen items.
create index if not exists items_reportedstolenat_active_idx
  on public.items (reportedstolenat)
  where deletedat is null and legacyat is null;

