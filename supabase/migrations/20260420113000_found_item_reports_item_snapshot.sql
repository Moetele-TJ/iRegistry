-- -----------------------------------------------------------------------------
-- Extend found-item reports with item-like snapshot fields
-- -----------------------------------------------------------------------------
-- When no registry match is found, police should capture enough detail to help
-- later matching & follow-up (like an item record, but without asserting ownership).

ALTER TABLE public.found_item_reports
  ADD COLUMN IF NOT EXISTS category text NULL,
  ADD COLUMN IF NOT EXISTS make text NULL,
  ADD COLUMN IF NOT EXISTS model text NULL,
  ADD COLUMN IF NOT EXISTS serial2_normalized text NULL,
  ADD COLUMN IF NOT EXISTS serial2_raw text NULL;

CREATE INDEX IF NOT EXISTS found_item_reports_make_idx
  ON public.found_item_reports (make);

CREATE INDEX IF NOT EXISTS found_item_reports_model_idx
  ON public.found_item_reports (model);

CREATE INDEX IF NOT EXISTS found_item_reports_serial2_open_idx
  ON public.found_item_reports (serial2_normalized, created_at DESC)
  WHERE status = 'OPEN';

