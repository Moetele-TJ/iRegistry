-- Police recovery case workflow per stolen item.
-- Rules:
-- 1) station: user may set explicitly when opening the case; if omitted, copy items.location at open time.
-- 2) At most one non-closed case per item; closed (ReturnedToOwner) rows may repeat for history.

CREATE TYPE public.police_item_case_status AS ENUM (
  'Open',
  'InCustody',
  'ClearedForReturn',
  'ReturnedToOwner'
);

CREATE TABLE public.item_police_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
  -- Resolved at case open: explicit user choice, or mirror of items.location if not provided in UI.
  station text NOT NULL,
  station_source text NOT NULL DEFAULT 'mirrored_from_location'
    CHECK (station_source IN ('user_selected', 'mirrored_from_location')),
  status public.police_item_case_status NOT NULL DEFAULT 'Open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz NULL,
  returned_at timestamptz NULL,
  evidence jsonb NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.item_police_cases IS
'Station police workflow for a stolen item. One active (non-returned) case per item; multiple rows allowed when prior cases are ReturnedToOwner.';

COMMENT ON COLUMN public.item_police_cases.station_source IS
'user_selected: officer/station chosen in modal; mirrored_from_location: copied from items.location when case opened.';

CREATE INDEX idx_item_police_cases_item_id ON public.item_police_cases (item_id);

CREATE INDEX idx_item_police_cases_station_status
  ON public.item_police_cases (station, status);

-- Only one "open" pipeline per item (not yet ReturnedToOwner).
-- When you add more terminal statuses, extend this predicate.
CREATE UNIQUE INDEX uq_item_police_cases_one_active_per_item
  ON public.item_police_cases (item_id)
  WHERE (status <> 'ReturnedToOwner'::public.police_item_case_status);

CREATE OR REPLACE FUNCTION public.set_item_police_cases_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_item_police_cases_updated
  BEFORE UPDATE ON public.item_police_cases
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_item_police_cases_updated_at ();
