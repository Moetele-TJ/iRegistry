-- Additive: legacy/obsolete items support (safe for production).
-- Legacy items are read-only "archived" items that remain visible in a separate view.

alter table public.items
  add column if not exists legacyat timestamp with time zone null,
  add column if not exists legacy_reason text null,
  add column if not exists legacy_by uuid null;

create index if not exists items_legacyat_idx on public.items (legacyat);

