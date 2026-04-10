-- Tie OTP reuse to a device so multi-device login doesn't get blocked.

alter table public.login_otps
  add column if not exists device_id text,
  add column if not exists device_name text;

create index if not exists login_otps_user_device_active_idx
  on public.login_otps (user_id, used, device_id, created_at desc);

