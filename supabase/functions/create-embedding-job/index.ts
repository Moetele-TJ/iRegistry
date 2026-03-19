//  supabase/functions/create-embedding-job/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

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

    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success:false, message:"Unauthorized" },
        corsHeaders,
        401
      );
    }

    const { itemId, photoPath } = await req.json();

    await supabase
      .from("embedding_jobs")
      .insert({
        item_id: itemId,
        photo_path: photoPath
      });

    return respond(
      { success:true },
      corsHeaders,
      200
    );

  } catch (err) {

    console.error(err);

    return respond(
      { success:false, message:"Job creation failed" },
      corsHeaders,
      500
    );

  }

});