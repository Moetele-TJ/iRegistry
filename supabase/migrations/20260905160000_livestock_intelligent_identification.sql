-- Livestock Intelligent Identification (Phase 1 foundation)
-- Separate domain from serial items. See docs/LIVESTOCK_INTELLIGENT_IDENTIFICATION_PLAN.md

-- ---------------------------------------------------------------------------
-- Task catalog
-- ---------------------------------------------------------------------------
INSERT INTO public.task_catalog (code, name, description, credits_cost, active)
VALUES
  (
    'LIVESTOCK_REGISTER_PACK',
    'Livestock registration pack',
    'Unlock 10 livestock registrations (after 2 lifetime free)',
    5,
    true
  ),
  (
    'LIVESTOCK_REVEAL_LOCATION',
    'Reveal livestock sighting location',
    'Unlock exact map pin for an accepted livestock sighting',
    2,
    true
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  credits_cost = EXCLUDED.credits_cost,
  active = EXCLUDED.active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Reference vocab (seeded + addable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livestock_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  brand_bearing boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.livestock_colours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.livestock_ear_mark_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.livestock_types (code, label, brand_bearing) VALUES
  ('cattle', 'Cattle', true),
  ('goat', 'Goat', false),
  ('sheep', 'Sheep', false),
  ('dog', 'Dog', false),
  ('donkey', 'Donkey', true),
  ('horse', 'Horse', true),
  ('camel', 'Camel', true),
  ('mule', 'Mule', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.livestock_colours (label) VALUES
  ('Tshumu'),
  ('Kgwana'),
  ('Khunohu')
ON CONFLICT (label) DO NOTHING;

INSERT INTO public.livestock_ear_mark_types (label) VALUES
  ('Lesifi'),
  ('Letsekana'),
  ('Kwena')
ON CONFLICT (label) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Owner registration pack state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livestock_owner_packs (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lifetime_registered integer NOT NULL DEFAULT 0 CHECK (lifetime_registered >= 0),
  pack_slots_remaining integer NOT NULL DEFAULT 0 CHECK (pack_slots_remaining >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.ensure_livestock_owner_pack()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.livestock_owner_packs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_livestock_owner_pack ON public.users;
CREATE TRIGGER trg_users_livestock_owner_pack
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_livestock_owner_pack();

INSERT INTO public.livestock_owner_packs (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Animals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livestock_animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type_code text NOT NULL REFERENCES public.livestock_types(code),
  gender text NULL CHECK (gender IS NULL OR gender IN ('male', 'female', 'unknown')),
  breed text NULL,
  colour text NULL,
  name text NULL,
  zone_brand text NULL,
  -- Dwelling (kraal / homestead) for distance notifications
  dwelling_lat double precision NULL,
  dwelling_lng double precision NULL,
  dwelling_village text NULL,
  dwelling_ward text NULL,
  dwelling_station text NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'missing', 'recovered', 'deleted')),
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_livestock_animals_owner
  ON public.livestock_animals (owner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_livestock_animals_type
  ON public.livestock_animals (type_code)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_livestock_animals_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_livestock_animals_updated_at ON public.livestock_animals;
CREATE TRIGGER trg_livestock_animals_updated_at
BEFORE UPDATE ON public.livestock_animals
FOR EACH ROW
EXECUTE FUNCTION public.set_livestock_animals_updated_at();

-- Brands (max 4 enforced in API)
CREATE TABLE IF NOT EXISTS public.livestock_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.livestock_animals(id) ON DELETE CASCADE,
  characters text NOT NULL,
  char_count integer NOT NULL CHECK (char_count IN (3, 4)),
  layout text NOT NULL CHECK (
    layout IN (
      'horizontal',
      'vertical',
      'two_up_one_down',
      'one_up_two_down',
      'square'
    )
  ),
  side text NOT NULL CHECK (side IN ('left', 'right')),
  body_part text NOT NULL CHECK (body_part IN ('shoulder', 'thigh', 'flank', 'neck')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT livestock_brands_layout_chars_check CHECK (
    (char_count = 3 AND layout IN ('horizontal', 'vertical', 'two_up_one_down', 'one_up_two_down'))
    OR (char_count = 4 AND layout = 'square')
  )
);

CREATE INDEX IF NOT EXISTS idx_livestock_brands_animal
  ON public.livestock_brands (animal_id);

CREATE INDEX IF NOT EXISTS idx_livestock_brands_characters
  ON public.livestock_brands (upper(characters));

-- Ear marks
CREATE TABLE IF NOT EXISTS public.livestock_ear_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.livestock_animals(id) ON DELETE CASCADE,
  mark_label text NOT NULL,
  side text NULL CHECK (side IS NULL OR side IN ('left', 'right')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livestock_ear_marks_animal
  ON public.livestock_ear_marks (animal_id);

-- Ear tags (max 2 enforced in API)
CREATE TABLE IF NOT EXISTS public.livestock_ear_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.livestock_animals(id) ON DELETE CASCADE,
  tag_id text NOT NULL,
  side text NOT NULL CHECK (side IN ('left', 'right')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livestock_ear_tags_animal
  ON public.livestock_ear_tags (animal_id);

CREATE INDEX IF NOT EXISTS idx_livestock_ear_tags_tag
  ON public.livestock_ear_tags (upper(tag_id));

-- ---------------------------------------------------------------------------
-- Embeddings (livestock-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livestock_image_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.livestock_animals(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  embedding vector,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (animal_id, photo_path)
);

CREATE INDEX IF NOT EXISTS idx_livestock_image_embeddings_animal
  ON public.livestock_image_embeddings (animal_id);

-- Optional: ivfflat only if extension/vector ops available (same as items)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vector'
  ) THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_livestock_image_embeddings_embedding
        ON public.livestock_image_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    EXCEPTION WHEN OTHERS THEN
      -- Index may fail on empty table / missing ops; non-fatal for deploy
      RAISE NOTICE 'livestock embedding index skipped: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.find_similar_livestock_images(
  query_embedding vector,
  similarity_threshold float DEFAULT 0.90,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  animal_id uuid,
  photo_path text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.animal_id,
    e.photo_path,
    (1 - (e.embedding <=> query_embedding))::float AS similarity
  FROM public.livestock_image_embeddings e
  JOIN public.livestock_animals a ON a.id = e.animal_id
  WHERE a.deleted_at IS NULL
    AND a.status <> 'deleted'
    AND e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT greatest(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.find_similar_livestock_images(vector, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_similar_livestock_images(vector, float, int) TO service_role;

-- ---------------------------------------------------------------------------
-- Sightings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.livestock_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.livestock_animals(id) ON DELETE CASCADE,
  reporter_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('photo', 'ear_tag', 'brand')),
  query_text text NULL,
  sighting_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  lat double precision NULL,
  lng double precision NULL,
  accuracy_m double precision NULL,
  distance_km double precision NULL,
  distance_band text NULL,
  stranger_confidence_boost boolean NOT NULL DEFAULT false,
  owner_decision text NOT NULL DEFAULT 'pending'
    CHECK (owner_decision IN ('pending', 'accepted', 'rejected')),
  owner_decided_at timestamptz NULL,
  location_revealed_at timestamptz NULL,
  notification_id uuid NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livestock_sightings_animal
  ON public.livestock_sightings (animal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_livestock_sightings_owner_pending
  ON public.livestock_sightings (owner_decision, created_at DESC)
  WHERE owner_decision = 'pending';

-- Candidates shown in a shortlist session (optional audit)
CREATE TABLE IF NOT EXISTS public.livestock_sighting_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id uuid NULL REFERENCES public.livestock_sightings(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  animal_id uuid NOT NULL REFERENCES public.livestock_animals(id) ON DELETE CASCADE,
  similarity float NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livestock_sighting_candidates_session
  ON public.livestock_sighting_candidates (session_id);

-- ---------------------------------------------------------------------------
-- Registration slot consume / pack purchase helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.livestock_can_register(p_user_id uuid)
RETURNS TABLE (
  allowed boolean,
  reason text,
  lifetime_registered integer,
  pack_slots_remaining integer,
  needs_pack boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_life int;
  v_slots int;
BEGIN
  INSERT INTO public.livestock_owner_packs (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT p.lifetime_registered, p.pack_slots_remaining
  INTO v_life, v_slots
  FROM public.livestock_owner_packs p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF v_life < 2 THEN
    RETURN QUERY SELECT true, 'FREE_TIER'::text, v_life, v_slots, false;
    RETURN;
  END IF;

  IF v_slots > 0 THEN
    RETURN QUERY SELECT true, 'PACK_SLOT'::text, v_life, v_slots, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'NEED_PACK'::text, v_life, v_slots, true;
END;
$$;

REVOKE ALL ON FUNCTION public.livestock_can_register(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.livestock_can_register(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.livestock_consume_registration_slot(p_user_id uuid)
RETURNS TABLE (success boolean, message text, lifetime_registered integer, pack_slots_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_life int;
  v_slots int;
BEGIN
  INSERT INTO public.livestock_owner_packs (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT p.lifetime_registered, p.pack_slots_remaining
  INTO v_life, v_slots
  FROM public.livestock_owner_packs p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF v_life < 2 THEN
    UPDATE public.livestock_owner_packs
    SET lifetime_registered = lifetime_registered + 1, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING livestock_owner_packs.lifetime_registered, livestock_owner_packs.pack_slots_remaining
    INTO v_life, v_slots;

    RETURN QUERY SELECT true, 'FREE_TIER'::text, v_life, v_slots;
    RETURN;
  END IF;

  IF v_slots <= 0 THEN
    RETURN QUERY SELECT false, 'NEED_PACK'::text, v_life, v_slots;
    RETURN;
  END IF;

  UPDATE public.livestock_owner_packs
  SET
    lifetime_registered = lifetime_registered + 1,
    pack_slots_remaining = pack_slots_remaining - 1,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING livestock_owner_packs.lifetime_registered, livestock_owner_packs.pack_slots_remaining
  INTO v_life, v_slots;

  RETURN QUERY SELECT true, 'PACK_SLOT'::text, v_life, v_slots;
END;
$$;

REVOKE ALL ON FUNCTION public.livestock_consume_registration_slot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.livestock_consume_registration_slot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.livestock_grant_registration_pack(p_user_id uuid)
RETURNS TABLE (success boolean, message text, pack_slots_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_bal integer;
  v_msg text;
  v_slots int;
BEGIN
  SELECT s.success, s.new_balance, s.message
  INTO v_ok, v_bal, v_msg
  FROM public.spend_credits(
    p_user_id,
    'LIVESTOCK_REGISTER_PACK',
    NULL,
    jsonb_build_object('kind', 'livestock-register-pack')
  ) AS s
  LIMIT 1;

  IF v_ok IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, coalesce(v_msg, 'INSUFFICIENT_CREDITS')::text, NULL::integer;
    RETURN;
  END IF;

  INSERT INTO public.livestock_owner_packs (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.livestock_owner_packs
  SET pack_slots_remaining = pack_slots_remaining + 10, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING livestock_owner_packs.pack_slots_remaining INTO v_slots;

  RETURN QUERY SELECT true, 'OK'::text, v_slots;
END;
$$;

REVOKE ALL ON FUNCTION public.livestock_grant_registration_pack(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.livestock_grant_registration_pack(uuid) TO service_role;

-- Haversine distance km
CREATE OR REPLACE FUNCTION public.livestock_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE (
      6371.0 * acos(
        least(
          1.0,
          greatest(
            -1.0,
            cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
            + sin(radians(lat1)) * sin(radians(lat2))
          )
        )
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.livestock_distance_band(p_km double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_km IS NULL THEN NULL
    WHEN p_km < 1 THEN 'less than 1 km'
    WHEN p_km < 3.5 THEN 'about 2 km'
    WHEN p_km < 7.5 THEN 'about 5 km'
    WHEN p_km < 15 THEN 'about 10 km'
    ELSE 'more than 10 km'
  END;
$$;

-- RLS: service role bypasses; no direct client access
ALTER TABLE public.livestock_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_ear_mark_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_owner_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_ear_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_ear_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_image_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestock_sighting_candidates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.livestock_animals IS
  'Livestock Intelligent Identification animals — separate from serial items registry.';
