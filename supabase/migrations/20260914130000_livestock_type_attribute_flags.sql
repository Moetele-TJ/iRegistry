-- Animal types share the same animal / brand / ear-tag / ear-mark tables.
-- Flags on livestock_types decide which attributes apply to each type.

ALTER TABLE public.livestock_types
  ADD COLUMN IF NOT EXISTS ear_tag_bearing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ear_mark_bearing boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.livestock_types.brand_bearing IS
  'When true, animals of this type may have brands (livestock_brands).';
COMMENT ON COLUMN public.livestock_types.ear_tag_bearing IS
  'When true, animals of this type may have ear tags (livestock_ear_tags).';
COMMENT ON COLUMN public.livestock_types.ear_mark_bearing IS
  'When true, animals of this type may have ear marks (livestock_ear_marks).';
COMMENT ON TABLE public.livestock_types IS
  'Catalog of animal kinds. Spelling (label) and attribute flags are admin-editable; code is the stable key referenced by livestock_animals.';
