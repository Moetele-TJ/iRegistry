// supabase/functions/public-photo-search/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders } from "../shared/cors.ts"
import { respond } from "../shared/respond.ts"
import { generateEmbedding } from "../shared/generateEmbedding.ts"
import { vectorSearch } from "../shared/vectorSearch.ts"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!
)

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!

serve(async (req) => {

  const corsHeaders = getCorsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {

    const { imageUrl } = await req.json()

    if (!imageUrl) {
      return respond(
        {
          success: false,
          message: "Image URL required"
        },
        corsHeaders,
        400
      )
    }

    /* ---------- generate embedding ---------- */

    const embedding = await generateEmbedding(imageUrl, REPLICATE_API_TOKEN)

    /* ---------- vector search ---------- */

    const matches = await vectorSearch(
      supabase,
      embedding,
      0.90
    )

    if (!matches || matches.length === 0) {

      return respond(
        {
          success: true,
          found: false
        },
        corsHeaders,
        200
      )
    }

    const match = matches[0]

    /* ---------- fetch limited item info ---------- */

    const { data: item } = await supabase
      .from("items")
      .select("id, category, make, model, reportedstolenat")
      .eq("id", match.item_id)
      .single()

    if (!item) {

      return respond(
        {
          success: true,
          found: false
        },
        corsHeaders,
        200
      )
    }

    const status = item.reportedstolenat ? "STOLEN" : "REGISTERED"

    return respond(
      {
        success: true,
        found: true,
        item: {
          id: item.id,
          category: item.category,
          make: item.make,
          model: item.model,
          status,
          reported: item.reportedstolenat
        }
      },
      corsHeaders,
      200
    )

  } catch (err) {

    console.error(err)

    return respond(
      {
        success: false,
        message: "Search failed"
      },
      corsHeaders,
      500
    )
  }

})