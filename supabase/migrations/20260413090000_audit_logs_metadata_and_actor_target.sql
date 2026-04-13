-- Additive audit log enrichment (safe for production).
-- Keeps existing columns intact; all new columns are nullable.

alter table public.audit_logs
  add column if not exists actor_user_id uuid null,
  add column if not exists target_user_id uuid null,
  add column if not exists severity text null,
  add column if not exists metadata jsonb null,
  add column if not exists request_id text null;

-- Optional: constrain severity to known values (non-breaking because NULL allowed).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'audit_logs_severity_check'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_severity_check
      check (severity is null or severity in ('low','medium','high','critical'));
  end if;
end $$;

-- Helpful indexes for filtering (safe if they already exist).
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_target_user_id_idx on public.audit_logs (target_user_id);
create index if not exists audit_logs_event_idx on public.audit_logs (event);

