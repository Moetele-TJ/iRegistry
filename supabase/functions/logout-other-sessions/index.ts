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

    const nowIso = new Date().toISOString();

    const { data: revokedRows, error } = await supabase
      .from("sessions")
      .update({ revoked: true })
      .eq("user_id", session.user_id)
      .eq("revoked", false)
      .gt("expires_at", nowIso)
      .neq("id", session.id)
      .select("id");

    if (error) {
      console.error("logout-other-sessions:", error.message);
      return respond({ success: false, message: "Failed to revoke sessions" }, corsHeaders, 500);
    }

    const count = revokedRows?.length ?? 0;

    await logAudit({
      supabase,
      event: "SELF_REVOKE_OTHER_SESSIONS",
      user_id: session.user_id,
      success: true,
      diag: `SELF-REV-${count}`,
      req,
    });

    return respond(
      {
        success: true,
        revoked_count: count,
        message: count === 0 ? "No other active sessions." : `Logged out of ${count} other device(s).`,
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("logout-other-sessions crash:", err);
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

