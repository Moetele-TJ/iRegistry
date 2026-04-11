-- Devices that have completed at least one email OTP login for a user.
-- SMS OTP is allowed only for trusted devices (or phone-only accounts with no email).

create table if not exists public.user_trusted_devices (
  user_id uuid not null references public.users (id) on delete cascade,
  device_id text not null,
  verified_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists user_trusted_devices_user_idx
  on public.user_trusted_devices (user_id);

comment on table public.user_trusted_devices is
  'Browser/device IDs that completed email OTP at least once; gates paid SMS OTP on new devices.';

-- One-time: treat existing session device_ids as trusted so current users are not forced through email-only on upgrade.
insert into public.user_trusted_devices (user_id, device_id, verified_at)
select distinct s.user_id, trim(s.device_id), min(s.created_at)
from public.sessions s
where s.device_id is not null
  and trim(s.device_id) <> ''
group by s.user_id, trim(s.device_id)
on conflict (user_id, device_id) do nothing;
