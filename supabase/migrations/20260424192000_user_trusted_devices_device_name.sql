-- Add device_name to trusted devices for human-friendly display.

alter table public.user_trusted_devices
  add column if not exists device_name text null;

-- Best-effort backfill from most recent session on that device.
with latest as (
  select distinct on (s.user_id, s.device_id)
    s.user_id,
    s.device_id,
    nullif(trim(s.device_name), '') as device_name
  from public.sessions s
  where s.device_id is not null
    and trim(s.device_id) <> ''
    and s.device_name is not null
    and trim(s.device_name) <> ''
  order by s.user_id, s.device_id, s.created_at desc
)
update public.user_trusted_devices utd
set device_name = l.device_name
from latest l
where utd.user_id = l.user_id
  and utd.device_id = l.device_id
  and (utd.device_name is null or trim(utd.device_name) = '');

