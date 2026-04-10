-- Indexes to keep session lookups fast as data grows.

create index if not exists sessions_active_lookup_idx
  on public.sessions (user_id, revoked, expires_at);

create index if not exists sessions_user_created_at_desc_idx
  on public.sessions (user_id, created_at desc);

