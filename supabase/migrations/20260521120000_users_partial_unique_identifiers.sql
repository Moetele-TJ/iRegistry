-- Soft-deleted accounts must not block re-registration with the same phone, email, or ID.
-- Replace table-wide UNIQUE constraints with partial indexes (active rows only).

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_number_key;

DROP INDEX IF EXISTS public.users_phone_active_key;
DROP INDEX IF EXISTS public.users_email_active_key;
DROP INDEX IF EXISTS public.users_id_number_active_key;

CREATE UNIQUE INDEX users_phone_active_key
  ON public.users (phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

CREATE UNIQUE INDEX users_email_active_key
  ON public.users (email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX users_id_number_active_key
  ON public.users (id_number)
  WHERE deleted_at IS NULL AND id_number IS NOT NULL;
