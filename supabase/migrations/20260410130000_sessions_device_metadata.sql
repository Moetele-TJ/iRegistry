-- Store per-device metadata on sessions for clearer UX.
-- Use a privacy-friendly device_id (random UUID stored on the device),
-- not a browser fingerprint.

alter table public.sessions
  add column if not exists device_id text,
  add column if not exists device_name text;

create index if not exists sessions_user_device_idx
  on public.sessions (user_id, device_id);

