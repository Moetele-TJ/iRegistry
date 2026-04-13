-- Stage C: remove legacy stored users.status and its check constraint.
-- User state is derived from:
-- - deleted_at (deleted)
-- - disabled_at (disabled)
-- - suspended_at (suspended)
-- - else active

alter table public.users
  drop constraint if exists users_status_check;

alter table public.users
  drop column if exists status;

