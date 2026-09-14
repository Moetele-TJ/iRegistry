-- Animals can be declared dead (livestock analog of item legacy).
-- Keep them out of the living registry, public identify, and owner "active" counts.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = 'public.livestock_animals'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%active%missing%recovered%deleted%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.livestock_animals DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.livestock_animals
  ADD CONSTRAINT livestock_animals_status_check
  CHECK (status IN ('active', 'missing', 'recovered', 'deleted', 'dead'));

CREATE OR REPLACE FUNCTION public.list_owner_active_livestock_counts ()
RETURNS TABLE (
  owner_id uuid,
  animal_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.owner_id,
    count(*)::bigint AS animal_count
  FROM public.livestock_animals a
  WHERE a.deleted_at IS NULL
    AND a.status IS DISTINCT FROM 'deleted'
    AND a.status IS DISTINCT FROM 'dead'
  GROUP BY a.owner_id;
$$;

REVOKE ALL ON FUNCTION public.list_owner_active_livestock_counts () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_owner_active_livestock_counts () TO service_role;

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
    AND a.status NOT IN ('deleted', 'dead')
    AND e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT greatest(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.find_similar_livestock_images(vector, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_similar_livestock_images(vector, float, int) TO service_role;
