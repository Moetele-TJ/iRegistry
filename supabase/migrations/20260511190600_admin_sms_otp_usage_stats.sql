-- Aggregated SMS OTP send usage for admin reporting (paid path: successful sends).
-- Source: audit_logs rows written by dispatch-otp (OTP_SENT + channel sms, success true;
--          SMS_SEND_FAILED + channel sms on provider failure after debit).

create or replace function public.admin_sms_otp_usage_stats(p_days integer default 30)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  with
  params as (
    select greatest(1, least(coalesce(p_days, 30), 365))::int as days
  ),
  bounds as (
    select
      (date_trunc('day', timezone('utc', now())) - ((select days from params) || ' days')::interval)
        as start_ts
  ),
  today as (
    select date_trunc('day', timezone('utc', now()))::date as d
  ),
  day_series as (
    select gs::date as day
    from bounds b
    cross join today t
    cross join lateral generate_series(b.start_ts::date, t.d, interval '1 day') as gs
  ),
  sent as (
    select
      (date_trunc('day', created_at at time zone 'utc'))::date as day,
      count(*)::bigint as n
    from audit_logs
    cross join bounds b
    where event = 'OTP_SENT'
      and channel = 'sms'
      and success is true
      and created_at >= b.start_ts
    group by 1
  ),
  failed as (
    select
      (date_trunc('day', created_at at time zone 'utc'))::date as day,
      count(*)::bigint as n
    from audit_logs
    cross join bounds b
    where event = 'SMS_SEND_FAILED'
      and channel = 'sms'
      and created_at >= b.start_ts
    group by 1
  )
  select jsonb_build_object(
    'days', (select days from params),
    'totals', jsonb_build_object(
      'sms_otp_sent_success', coalesce((select sum(n) from sent), 0),
      'sms_send_failed', coalesce((select sum(n) from failed), 0)
    ),
    'by_day', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', ds.day,
            'sms_otp_sent_success', coalesce(s.n, 0),
            'sms_send_failed', coalesce(f.n, 0)
          )
          order by ds.day
        )
        from day_series ds
        left join sent s on s.day = ds.day
        left join failed f on f.day = ds.day
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.admin_sms_otp_usage_stats(integer) from public;
grant execute on function public.admin_sms_otp_usage_stats(integer) to service_role;

create index if not exists audit_logs_sms_otp_usage_idx
  on public.audit_logs (event, channel, created_at desc);
