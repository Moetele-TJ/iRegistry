-- Public login feed removed; admin-only via admin_recent_logins_stats.

drop function if exists public.get_recent_logins_public(integer);
