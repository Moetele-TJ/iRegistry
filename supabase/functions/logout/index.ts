import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashToken } from "../shared/crypto.ts";
import { logAudit } from "../shared/logAudit.ts";

/* ---------------- HEADERS ---------------- */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

/* ---------------- HELPERS ---------------- */

function respond(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: corsHeaders,
  });
}

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
      return respond({
        success: false,
        diag: "LOG-001",
        message: "Missing authorization token",
      });
    }

    const token = auth.replace("Bearer ", "");
    const tokenHash = await hashToken(token);

    /* 🔍 FIND SESSION */

    const { data: session } = await supabase
      .from("sessions")
      .select("id,user_id,expires_at,revoked")
      .eq("token", tokenHash)
      .maybeSingle();

    if (!session) {
      return respond({
        success: false,
        diag: "LOG-002",
        message: "Session not found",
      });
    }

    //-----------------------------------
    // CHECK IF SESSION ALREADY REVOKED
    //-----------------------------------
    if (session.revoked) {
      return respond({
        success: false,
        diag: "LOG-REV-003",
        message: "Session already revoked"
      });
    }

    //-----------------------------------
    // CHECK IF SESSION EXPIRED
    //-----------------------------------
    if (new Date(session.expires_at) < new Date()) {
      return respond({
        success: false,
        diag: "LOG-004",
        message: "Session expired"
      });
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
      id_number: session.user_id,
      success: true,
      diag: "LOG-OK",
      req
    });

    return respond({
      success: true,
      message: "Logged out successfully",
    });

  } catch (err) {
    console.error("logout crash:", err);

    return respond({
      success: false,
      diag: "LOG-500",
      message: "Unexpected server error",
    });
  }
});