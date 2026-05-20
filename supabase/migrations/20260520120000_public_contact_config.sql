-- Public contact details for /contact (editable in admin Settings).

CREATE TABLE IF NOT EXISTS public.public_contact_config (
  id integer PRIMARY KEY CHECK (id = 1),
  operator_name text NOT NULL DEFAULT 'iRegistry',
  support_email text NULL,
  support_phone text NULL,
  support_whatsapp text NULL,
  support_address text NULL,
  support_hours text NULL,
  support_tagline text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id)
);

INSERT INTO public.public_contact_config (
  id,
  operator_name,
  support_email,
  support_phone,
  support_whatsapp,
  support_address,
  support_hours,
  support_tagline
)
VALUES (
  1,
  'iRegistry',
  'info@iregsys.com',
  '+267 72293952',
  '26772293952',
  E'Plot Number 60491, Block 7\nGaborone, Botswana',
  'Mon–Fri 08:00–17:00 (CAT)',
  'Keeping it safe'
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_public_contact_config_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_contact_config_updated_at ON public.public_contact_config;
CREATE TRIGGER trg_public_contact_config_updated_at
BEFORE UPDATE ON public.public_contact_config
FOR EACH ROW
EXECUTE FUNCTION public.set_public_contact_config_updated_at();

ALTER TABLE public.public_contact_config ENABLE ROW LEVEL SECURITY;
