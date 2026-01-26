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

/* ---------------- RESPONSE ---------------- */

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

/* ---------------- CONFIG ---------------- */

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization");

    if (!auth || !auth.startsWith("Bearer ")) {
      return respond({
        success: false,
        diag: "VAL-SESS-001",
        message: "Missing authorization token",
      });
    }

    const token = auth.replace("Bearer ", "");
    const tokenHash = await hashToken(token);

    // 🔍 Lookup session
    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, user_id, role, expires_at, revoked")
      .eq("token", tokenHash)
      .maybeSingle();

    if (error || !session) {
      return respond({
        success: false,
        diag: "VAL-SESS-002",
        message: "Invalid session",
      });
    }

    if (session.revoked) {
      return respond({
        success: false,
        diag: "VAL-SESS-003",
        message: "Session revoked",
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return respond({
        success: false,
        diag: "VAL-SESS-004",
        message: "Session expired",
      });
    }

    // 🔄 REFRESH SESSION (sliding expiration)
    const newExpiry = new Date(Date.now() + SESSION_TTL_MS);

    await supabase
      .from("sessions")
      .update({ expires_at: newExpiry })
      .eq("id", session.id);

    await logAudit({
      supabase,
      event: "SESSION_REFRESH",
      id_number: session.user_id,
      success: true,
      diag: "SESS-REFRESH",
      req,
    });

    // ✅ Valid + refreshed session
    return respond({
      success: true,
      user_id: session.user_id,
      role: session.role,
      refreshed: true,
      expires_at: newExpiry,
    });

  } catch (err) {
    console.error("validate-session crash:", err);
    return respond({
      success: false,
      diag: "VAL-SESS-500",
      message: "Server error",
    });
  }
});