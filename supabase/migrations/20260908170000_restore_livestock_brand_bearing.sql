-- Restore brand-bearing flags that may have been cleared by type vocab upserts.
UPDATE public.livestock_types
SET brand_bearing = true
WHERE code IN ('cattle', 'donkey', 'horse', 'camel', 'mule');
