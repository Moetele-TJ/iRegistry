import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { logAudit } from "../shared/logAudit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function isUuid(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    )
  );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    const body = await req.json().catch(() => null);
    const action = body?.action || "list";
    const nowIso = new Date().toISOString();

    if (action === "list") {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, created_at, expires_at, ip_address, user_agent, revoked, device_id, device_name")
        .eq("user_id", session.user_id)
        .eq("revoked", false)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("self-sessions list:", error.message);
        return respond({ success: false, message: "Failed to load sessions" }, corsHeaders, 500);
      }

      return respond({ success: true, sessions: data || [] }, corsHeaders, 200);
    }

    if (action === "revoke") {
      const sessionId = body?.session_id;
      if (!isUuid(sessionId)) {
        return respond({ success: false, message: "Invalid session id" }, corsHeaders, 400);
      }

      if (String(sessionId) === String(session.id)) {
        return respond(
          { success: false, message: "You cannot revoke your current session from this device." },
          corsHeaders,
          400,
        );
      }

      const { data: revokedRows, error } = await supabase
        .from("sessions")
        .update({ revoked: true })
        .eq("id", sessionId)
        .eq("user_id", session.user_id)
        .eq("revoked", false)
        .select("id");

      if (error) {
        console.error("self-sessions revoke:", error.message);
        return respond({ success: false, message: "Failed to revoke session" }, corsHeaders, 500);
      }

      const ok = (revokedRows?.length ?? 0) > 0;
      if (!ok) {
        return respond({ success: false, message: "Session not found" }, corsHeaders, 404);
      }

      await logAudit({
        supabase,
        event: "SELF_SESSION_REVOKE",
        user_id: session.user_id,
        success: true,
        diag: "SELF-SES-REV",
        req,
      });

      return respond({ success: true, message: "Session revoked" }, corsHeaders, 200);
    }

    return respond({ success: false, message: "Unknown action" }, corsHeaders, 400);
  } catch (err: any) {
    console.error("self-sessions crash:", err);
    return respond(
      {
        success: false,
        message: err?.message || "Unexpected server error",
      },
      corsHeaders,
      500,
    );
  }
});

