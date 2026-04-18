-- -----------------------------------------------------------------------------
-- Police impound / found-item reports (serial-based matching)
-- -----------------------------------------------------------------------------
-- Purpose:
-- - Allow police to record a found/impounded item by serial when it is not yet in the registry.
-- - When a user later registers an item with a matching serial, we can:
--   - create a station case (item_police_cases) for the reporting station
--   - notify the new owner that police has a matching item
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'found_item_report_status') THEN
    CREATE TYPE public.found_item_report_status AS ENUM ('OPEN', 'MATCHED', 'CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.found_item_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_normalized text NOT NULL,
  serial_raw text NULL,
  station text NOT NULL,
  officer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  notes text NULL,
  status public.found_item_report_status NOT NULL DEFAULT 'OPEN',
  matched_item_id uuid NULL REFERENCES public.items(id) ON DELETE SET NULL,
  matched_owner_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  matched_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by serial for OPEN reports
CREATE INDEX IF NOT EXISTS found_item_reports_serial_open_idx
  ON public.found_item_reports (serial_normalized, created_at DESC)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS found_item_reports_station_idx
  ON public.found_item_reports (station, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_found_item_reports_updated_at ON public.found_item_reports;
CREATE TRIGGER trg_found_item_reports_updated_at
BEFORE UPDATE ON public.found_item_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.found_item_reports TO service_role;

