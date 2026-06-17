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

    const [{ data, error }, { data: promoActive, error: promoErr }, { data: competitionActive, error: competitionErr }] =
      await Promise.all([
      supabase.rpc("public_registry_stats"),
      supabase.rpc("is_promo_active", { p_user_id: null }),
      supabase.rpc("is_referral_competition_active"),
    ]);

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

    if (promoErr) {
      console.error("PROMO RPC ERROR:", promoErr);
    }

    if (competitionErr) {
      console.error("COMPETITION RPC ERROR:", competitionErr);
    }

    /* ================= RESPONSE ================= */

    return respond(
      {
        success: true,
        stats: data ?? {},
        promo_active: promoErr ? false : Boolean(promoActive),
        referral_competition_active: competitionErr ? false : Boolean(competitionActive),
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