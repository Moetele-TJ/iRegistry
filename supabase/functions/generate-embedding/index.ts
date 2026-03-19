// supabase/functions/generate-embedding/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "npm:replicate";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const replicate = new Replicate({
  auth: Deno.env.get("REPLICATE_API_TOKEN")
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {

  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {

    /* ---------- AUTH ---------- */

    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success:false,
          message:"Unauthorized"
        },
        corsHeaders,
        401
      );
    }

    /* ---------- INPUT ---------- */

    const { itemId, photoPath } = await req.json();

    if (!itemId || !photoPath) {
      return respond(
        {
          success:false,
          message:"Missing itemId or photoPath"
        },
        corsHeaders,
        400
      );
    }

    /* ---------- DOWNLOAD ORIGINAL IMAGE ---------- */

    const { data, error } = await supabase
      .storage
      .from("item-photos")
      .download(photoPath);

    if (error || !data) {
      return respond(
        {
          success:false,
          message:"Image not found"
        },
        corsHeaders,
        404
      );
    }

    const buffer = await data.arrayBuffer();

    const base64 = btoa(
      new Uint8Array(buffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const imageData = `data:image/jpeg;base64,${base64}`;

    /* ---------- GENERATE EMBEDDING ---------- */

    const embedding = await replicate.run(
      "openai/clip-vit-base-patch32",
      {
        input: {
          image: imageData
        }
      }
    );

    if (!embedding) {
      throw new Error("Embedding generation failed");
    }

    /* ---------- STORE VECTOR ---------- */

    await supabase
      .from("image_embeddings")
      .insert({
        item_id: itemId,
        photo_path: photoPath,
        embedding
      });

    /* ---------- FIND SIMILAR IMAGES ---------- */

    const { data: matches } = await supabase.rpc(
      "match_images",
      {
        query_embedding: embedding,
        match_threshold: 0.8,
        match_count: 5
      }
    );

    return respond(
      {
        success:true,
        matches
      },
      corsHeaders,
      200
    );

  } catch (err) {

    console.error(err);

    return respond(
      {
        success:false,
        message:"Embedding generation failed"
      },
      corsHeaders,
      500
    );

  }

});