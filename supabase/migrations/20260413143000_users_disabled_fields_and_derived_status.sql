-- Additive: derived user status support (safe for production).
-- Status is derived from timestamps:
-- - deleted_at => deleted
-- - disabled_at => disabled
-- - suspended_at => suspended
-- - else => active

alter table public.users
  add column if not exists disabled_at timestamp with time zone null,
  add column if not exists disabled_reason text null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_derived_status_check') then
    alter table public.users
      add constraint users_derived_status_check
      check (
        -- deleted cannot also be disabled/suspended
        (deleted_at is null or (disabled_at is null and suspended_at is null))
        and
        -- disabled and suspended are mutually exclusive
        (disabled_at is null or suspended_at is null)
      );
  end if;
end $$;

create index if not exists users_active_idx
  on public.users (id)
  where deleted_at is null and suspended_at is null and disabled_at is null;

