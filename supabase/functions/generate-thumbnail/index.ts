import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/** Legacy: copy original bytes to thumb path (client uploads both for new items). */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth =
      req.headers.get("authorization") || req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);
    if (!session) {
      return respond(
        { success: false, message: "Unauthorized" },
        corsHeaders,
        401,
      );
    }

    const body = await req.json().catch(() => null);
    const originalPath =
      typeof body?.originalPath === "string" ? body.originalPath.trim() : "";
    const thumbPath =
      typeof body?.thumbPath === "string" ? body.thumbPath.trim() : "";

    if (!originalPath || !thumbPath) {
      return respond(
        { success: false, message: "originalPath and thumbPath are required." },
        corsHeaders,
        400,
      );
    }

    const { data, error: downloadError } = await supabase.storage
      .from("item-photos")
      .download(originalPath);

    if (downloadError || !data) {
      return respond(
        { success: false, message: "Original image not found in storage." },
        corsHeaders,
        404,
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const contentType = data.type || "image/jpeg";

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(thumbPath, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("generate-thumbnail upload:", uploadError);
      return respond(
        {
          success: false,
          message: uploadError.message || "Thumbnail upload failed.",
        },
        corsHeaders,
        500,
      );
    }

    return respond({ success: true }, corsHeaders, 200);
  } catch (err) {
    console.error("generate-thumbnail crash:", err);
    return respond(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "Thumbnail generation failed.",
      },
      corsHeaders,
      500,
    );
  }
});
