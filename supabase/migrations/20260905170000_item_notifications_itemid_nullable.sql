-- Allow livestock (and other non-item) owner pings via item_notifications
ALTER TABLE public.item_notifications
  ALTER COLUMN itemid DROP NOT NULL;

COMMENT ON COLUMN public.item_notifications.itemid IS
  'Nullable for non-item notifications (e.g. livestock sightings).';
