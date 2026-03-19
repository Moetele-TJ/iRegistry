// supabase/functions/process-embedding-queue/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { generateEmbedding } from "../shared/generateEmbedding.ts"
import { cosineSimilarity } from "../shared/cosineSimilarity.ts"
import { vectorSearch } from "../shared/vectorSearch.ts"
import { getCorsHeaders } from "../shared/cors.ts"
import { respond } from "../shared/respond.ts"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!

const MAX_JOBS = 5

serve(async (req) => {

  const corsHeaders = getCorsHeaders(req)
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {

    /* ---------- fetch pending jobs ---------- */

    const { data: jobs, error } = await supabase
      .from("embedding_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_on", { ascending: true })
      .limit(MAX_JOBS)

    if (error) throw error

    if (!jobs || jobs.length === 0) {
      return respond(
        {
          success: true,
          processed: 0
        },
        corsHeaders,
        200
      )
    }

    let processed = 0

    for (const job of jobs) {

      try {

        /* ---------- mark job processing ---------- */

        await supabase
          .from("embedding_jobs")
          .update({ status: "processing" })
          .eq("id", job.id)

        const path = job.thumb_path || job.photo_path

        /* ---------- get signed download url ---------- */

        const { data: signed } = await supabase
          .storage
          .from("item-photos")
          .createSignedUrl(path, 60)

        if (!signed?.signedUrl) {
          throw new Error("Failed to create signed URL")
        }

        const imageUrl = signed.signedUrl

        /* ---------- generate embedding via Replicate ---------- */

        const embedding = await generateEmbedding(imageUrl, REPLICATE_API_TOKEN)

        /* ---------- fetch item status ---------- */

        const { data: item } = await supabase
          .from("items")
          .select("reportedstolenat")
          .eq("id", job.item_id)
          .single();

        const isStolen = item?.reportedstolenat !== null;

        /* ---------- store embedding ---------- */

        await supabase
          .from("image_embeddings")
          .insert({
            item_id: job.item_id,
            photo_path: job.photo_path,
            embedding,
            is_stolen: isStolen
          }
        )

        /* ---------- duplicate detection ---------- */

        const { data: duplicates } = await supabase.rpc(
          "find_duplicate_images",
          {
            query_embedding: embedding,
            similarity_threshold: 0.95
          }
        );

        if (duplicates && duplicates.length > 0) {

          for (const match of duplicates) {

            if (match.item_id !== job.item_id) {

              await supabase
              .from("duplicate_item_alerts")
              .upsert({
                new_item_id: job.item_id,
                existing_item_id: match.item_id,
                similarity: match.similarity,
                photo_path: job.photo_path
              });

            }

          }

        }

        /* ---------- similarity search ---------- */

        const matches = await vectorSearch(
          supabase,
          embedding,
          0.90
        )

        if (matches && matches.length > 0) {

          console.log("Potential match detected", matches)

          for (const match of matches) {

            if (match.item_id !== job.item_id) {

              /* ---------- fetch candidate item photos ---------- */

              const { data: candidateItem } = await supabase
                .from("items")
                .select("photos")
                .eq("id", match.item_id)
                .single()

              if (!candidateItem?.photos) continue

              let bestSimilarity = match.similarity

              /* ---------- compare against all candidate photos ---------- */

              for (const photo of candidateItem.photos) {

                /* ---------- fetch existing embedding ---------- */

                const { data: candidateEmbeddingRow } = await supabase
                  .from("image_embeddings")
                  .select("embedding")
                  .eq("photo_path", photo.original || photo.thumb)
                  .maybeSingle()

                if (
                  !candidateEmbeddingRow?.embedding ||
                  candidateEmbeddingRow.embedding.length !== embedding.length
                ) continue

                const candidateEmbedding = candidateEmbeddingRow.embedding

                /* ---------- compute similarity ---------- */

                const cosine = cosineSimilarity(
                  embedding,
                  candidateEmbedding
                )

                if (cosine > bestSimilarity) {
                  bestSimilarity = cosine
                }

              }

              /* ---------- create alert if strong match ---------- */

              if (bestSimilarity > 0.90) {

                const { data: alertInsert } = await supabase
                  .from("similarity_alerts")
                  .upsert(
                    {
                      source_item_id: job.item_id,
                      matched_item_id: match.item_id,
                      similarity: bestSimilarity,
                      photo_path: job.photo_path
                    },
                    { onConflict: "source_item_id,matched_item_id" }
                  )
                  .select()

                if (alertInsert && alertInsert.length > 0) {
                  await supabase.rpc("create_similarity_notification", {
                    source_item: job.item_id,
                    matched_item: match.item_id,
                    similarity_score: bestSimilarity
                  })
                }

              }

            }

          }
        }

        /* ---------- mark job complete ---------- */

        await supabase
          .from("embedding_jobs")
          .update({
            status: "complete",
            processed_on: new Date().toISOString()
          })
          .eq("id", job.id)

        processed++

      } catch (jobError) {

        console.error("Job failed:", jobError)

        await supabase
          .from("embedding_jobs")
          .update({
            status: "failed",
            attempts: job.attempts + 1
          })
          .eq("id", job.id)
      }
    }

    return respond(
      {
        success: true,
        processed
      },
      corsHeaders,
      200
    )

  } catch (err) {

    console.error(err)

    return respond(
      {
        success: false,
        message: "Queue processing failed"
      },
      corsHeaders,
      500
    )
  }
})