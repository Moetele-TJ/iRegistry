-- Only return per-day rows when there was SMS OTP activity (sent or provider failure).

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
  ),
  days_with_activity as (
    select day from sent
    union
    select day from failed
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
        from days_with_activity ds
        left join sent s on s.day = ds.day
        left join failed f on f.day = ds.day
      ),
      '[]'::jsonb
    )
  );
$$;
