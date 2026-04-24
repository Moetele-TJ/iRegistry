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
    const body = await req.json().catch(() => null);
    const bodyToken = body?.session_token;
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const headerToken = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    const token = bodyToken || headerToken;

    // If no token → logout locally only (idempotent success)
    if (!token) {
      return respond(
        { success: true, message: "Logged out successfully" },
        corsHeaders,
        200
      );
    }

    const tokenHash = await hashToken(token);

    /* 🔍 FIND SESSION */

    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, user_id, revoked")
      .eq("token", tokenHash)
      .maybeSingle();

    if (error) {
      console.error("Logout DB lookup error:", error.message);
      return respond(
        {
          success: false,
          diag: "LOG-DB-001",
          message: "Database error during logout",
        },
        corsHeaders,
        500
      );
    }

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

    const { error: revokeError } = await supabase
      .from("sessions")
      .update({ revoked: true })
      .eq("id", session.id);

    if (revokeError) {
      console.error("Logout revoke error:", revokeError.message);
      return respond(
        {
          success: false,
          diag: "LOG-DB-002",
          message: "Failed to revoke session",
        },
        corsHeaders,
        500
      );
    }

    /* 📝 AUDIT */

    await logAudit({
      supabase,
      event: "LOGOUT_toggle",
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