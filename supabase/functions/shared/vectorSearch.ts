//  supabase/functions/shared/vectorSearch.ts
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export async function vectorSearch(
  supabase: SupabaseClient,
  embedding: number[],
  threshold = 0.90
) {

    const { data, error } = await supabase.rpc(
        "find_similar_images",
        {
        query_embedding: embedding,
        similarity_threshold: threshold
        }
    )

    if (error) {
        throw new Error("Vector search failed")
    }

    return data || []
}