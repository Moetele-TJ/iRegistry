-- Derive last login from sessions, efficiently.
-- We treat "last login" as the most recent session creation timestamp.

-- Speed up per-user "latest session" lookups.
create index if not exists sessions_user_id_created_at_desc_idx
  on public.sessions (user_id, created_at desc);

-- One row per user with their most recent login time.
create or replace view public.session_last_login as
select
  user_id,
  max(created_at) as last_login_at
from public.sessions
group by user_id;

