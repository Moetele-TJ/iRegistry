-- Recent successful logins derived from sessions.created_at (OTP verify creates a session).
-- Admin-only: use admin_recent_logins_stats via admin-recent-logins edge function.

create or replace function public.admin_recent_logins_stats(
  p_days integer default 30,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  start_ts timestamptz;
  recent jsonb;
  by_user jsonb;
begin
  start_ts := date_trunc('day', timezone('utc', now())) - (d || ' days')::interval;

  select coalesce(
    jsonb_agg(row_to_json(r) order by r.created_at desc),
    '[]'::jsonb
  )
  into recent
  from (
    select
      s.id as session_id,
      s.created_at,
      s.device_name,
      s.ip_address,
      u.id as user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.role
    from public.sessions s
    inner join public.users u on u.id = s.user_id
    where u.deleted_at is null
      and s.created_at >= start_ts
      and (p_user_id is null or s.user_id = p_user_id)
    order by s.created_at desc
    limit 100
  ) r;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', g.user_id,
        'user', jsonb_build_object(
          'id', g.user_id,
          'first_name', g.first_name,
          'last_name', g.last_name,
          'email', g.email,
          'role', g.role
        ),
        'login_count', g.login_count,
        'last_login_at', g.last_login_at,
        'logins', g.logins
      )
      order by g.last_login_at desc
    ),
    '[]'::jsonb
  )
  into by_user
  from (
    select
      s.user_id,
      max(u.first_name) as first_name,
      max(u.last_name) as last_name,
      max(u.email) as email,
      max(u.role) as role,
      count(*)::bigint as login_count,
      max(s.created_at) as last_login_at,
      jsonb_agg(
        jsonb_build_object(
          'session_id', s.id,
          'created_at', s.created_at,
          'device_name', s.device_name,
          'ip_address', s.ip_address
        )
        order by s.created_at desc
      ) as logins
    from public.sessions s
    inner join public.users u on u.id = s.user_id
    where u.deleted_at is null
      and s.created_at >= start_ts
      and (p_user_id is null or s.user_id = p_user_id)
    group by s.user_id
  ) g;

  return jsonb_build_object(
    'days', d,
    'filter_user_id', p_user_id,
    'recent', recent,
    'by_user', by_user
  );
end;
$$;

revoke all on function public.admin_recent_logins_stats(integer, uuid) from public;

grant execute on function public.admin_recent_logins_stats(integer, uuid) to service_role;
