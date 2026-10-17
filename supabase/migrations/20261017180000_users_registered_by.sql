-- Who created a registry account (staff add-user / org member). Null for public self-signup.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS registered_by uuid NULL REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_registered_by
  ON public.users (registered_by);

COMMENT ON COLUMN public.users.registered_by IS
  'Staff user who registered this account. Null for public self-signup.';

-- Backfill from the first USER_CREATED log that was not self-signup.
UPDATE public.users u
SET registered_by = src.actor_id
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    actor_id
  FROM public.user_activity_logs
  WHERE action = 'USER_CREATED'
    AND actor_id IS NOT NULL
    AND actor_id <> user_id
  ORDER BY user_id, created_at ASC
) src
WHERE u.id = src.user_id
  AND u.registered_by IS NULL;
