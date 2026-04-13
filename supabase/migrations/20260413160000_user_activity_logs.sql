-- User account timeline (profile/admin actions). Item and other events stay in activity_logs.

create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  actor_role text,
  user_display_name text,
  action text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activity_logs_user_created
  on public.user_activity_logs (user_id, created_at desc);

create index if not exists idx_user_activity_logs_actor_created
  on public.user_activity_logs (actor_id, created_at desc);

comment on table public.user_activity_logs is
  'Timeline for a user account (profile/admin events). Distinct from activity_logs (items, etc.).';

-- Move legacy user rows out of activity_logs so feeds stay consistent.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'activity_logs'
  ) then
    insert into public.user_activity_logs (
      user_id,
      actor_id,
      actor_role,
      user_display_name,
      action,
      message,
      metadata,
      created_at
    )
    select
      al.entity_id,
      al.actor_id,
      al.actor_role,
      al.entity_name,
      al.action,
      al.message,
      al.metadata,
      al.created_at
    from public.activity_logs al
    where al.entity_type = 'user'
      and al.entity_id is not null;

    delete from public.activity_logs where entity_type = 'user';
  end if;
end $$;

-- Single feed for dashboards: non-user activity_logs + dedicated user_activity_logs.
create or replace view public.unified_activity_feed as
select
  al.id,
  al.actor_id,
  al.actor_role,
  al.entity_type::text as entity_type,
  al.entity_id::text as entity_id,
  al.entity_name,
  al.action,
  al.message,
  al.metadata,
  al.created_at
from public.activity_logs al
where al.entity_type is distinct from 'user'

union all

select
  ual.id,
  ual.actor_id,
  ual.actor_role,
  'user'::text as entity_type,
  ual.user_id::text as entity_id,
  ual.user_display_name as entity_name,
  ual.action,
  ual.message,
  ual.metadata,
  ual.created_at
from public.user_activity_logs ual;

comment on view public.unified_activity_feed is
  'activity_logs (excluding legacy entity_type=user) union user_activity_logs for dashboard feeds.';
