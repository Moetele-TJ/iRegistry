//  supabase/functions/get-item-activity/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    /* ================= AUTH ================= */

    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          message: "Invalid session"
        },
        corsHeaders,
        401
      );
    }

    /* ================= INPUT ================= */

    const body = await req.json().catch(() => ({}));
    const { itemId } = body;

    if (!itemId) {
      return respond(
        {
          success: false,
          message: "itemId is required"
        },
        corsHeaders,
        400
      );
    }

    /* ================= QUERY ================= */

    const { data, error } = await supabase
      .from("activity_logs")
      .select(`
        id,
        entity_type,
        entity_id,
        entity_name,
        action,
        message,
        metadata,
        created_at
      `)
      .eq("entity_type", "item")
      .eq("entity_id", itemId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    /* ================= RESPONSE ================= */

    return respond(
      {
        success: true,
        activity: data || []
      },
      corsHeaders,
      200
    );

  } catch (err) {

    console.error("get-item-activity crash:", err);

    return respond(
      {
        success: false,
        message: "Failed to fetch item activity"
      },
      corsHeaders,
      500
    );
  }
});