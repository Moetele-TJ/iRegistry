// supabase/functions/logout/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashToken } from "../shared/crypto.ts";
import { logAudit } from "../shared/logAudit.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
      return respond(
        {
          success: true,
          message: "Logged out successfully",
        },
        corsHeaders,
        200
      );
    }

    const token = auth.replace("Bearer ", "");
    const tokenHash = await hashToken(token);

    /* 🔍 FIND SESSION */

    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id, revoked")
      .eq("token", tokenHash)
      .maybeSingle();

    // No session → already logged out
    if (!session) {
      return respond(
        { success: true, message: "Logged out successfully" },
        corsHeaders,
        200
      );
    }

    // Already revoked → idempotent success
    if (session.revoked) {
      return respond(
        { success: true, message: "Logged out successfully" },
        corsHeaders,
        200
      );
    }

    /* 🚫 REVOKE SESSION */

    await supabase
      .from("sessions")
      .update({ revoked: true })
      .eq("id", session.id);

    /* 📝 AUDIT */

    await logAudit({
      supabase,
      event: "LOGOUT",
      user_id: session.user_id,
      success: true,
      diag: "LOG-OK",
      req,
    });

    return respond(
      {
        success: true,
        message: "Logged out successfully",
      },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("logout crash:", err);

    return respond(
      {
        success: false,
        diag: "LOG-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});