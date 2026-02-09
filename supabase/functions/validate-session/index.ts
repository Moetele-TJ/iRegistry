// supabase/functions/validate-session/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { hashToken } from "../shared/crypto.ts";
import { logAudit } from "../shared/logAudit.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

/* ---------------- SUPABASE ---------------- */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ---------------- CONFIG ---------------- */

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    //================================================
    const JWT_SECRET = Deno.env.get("JWT_SECRET");
    if (!JWT_SECRET) {
      return respond({
        success: false,
        diag: "VAL-SESS-CONFIG",
        message: "Server configuration error",
      });
    }

    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      await verify(token, key);
    } catch {
      return respond({
        success: false,
        diag: "VAL-SESS-JWT",
        message: "Invalid or expired token",
      });
    }
    //===================================================
    
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
    const now = Date.now();
    const expiresAt = new Date(session.expires_at).getTime();
    const remainingMs = expiresAt - now;

    let refreshed = false;
    let newExpiry = new Date(session.expires_at);

    if (remainingMs <= REFRESH_THRESHOLD_MS) {
      newExpiry = new Date(now + SESSION_TTL_MS);

      await supabase
        .from("sessions")
        .update({ expires_at: newExpiry })
        .eq("id", session.id);

      refreshed = true;

      await logAudit({
        supabase,
        event: "SESSION_REFRESH",
        user_id: session.user_id,
        success: true,
        diag: "SESS-REFRESH",
        req,
      });
    }

    // ✅ Valid + refreshed session
    return respond({
      success: true,
      user_id: session.user_id,
      role: session.role,
      refreshed,
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