//  📄 supabase/functions/get-public-stats/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* ================= CALL MASTER SQL FUNCTION ================= */

    const { data, error } = await supabase.rpc(
      "public_registry_stats"
    );

    if (error) {
      console.error("RPC ERROR:", error);

      return respond(
        {
          success: false,
          message: "Failed to load public statistics",
        },
        corsHeaders,
        500
      );
    }

    /* ================= RESPONSE ================= */

    return respond(
      {
        success: true,
        stats: data ?? {},
      },
      corsHeaders,
      200
    );

  } catch (err) {
    console.error("get-public-stats crash:", err);

    return respond(
      {
        success: false,
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});