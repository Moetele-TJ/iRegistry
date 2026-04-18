import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { logAudit } from "../shared/logAudit.ts";
import { roleIs } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!roleIs(session.role, "admin")) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const body = await req.json().catch(() => null);
    const { org_payment_id, reason } = body ?? {};

    if (!org_payment_id || typeof org_payment_id !== "string") {
      return respond({ success: false, message: "org_payment_id is required" }, corsHeaders, 400);
    }

    const { data: res, error } = await supabase.rpc("reverse_org_payment", {
      p_org_payment_id: org_payment_id,
      p_actor_id: session.user_id,
      p_reason: typeof reason === "string" ? reason : null,
    });

    const row = Array.isArray(res) ? res[0] : res;
    if (error || !row?.success) {
      return respond(
        { success: false, message: row?.message || error?.message || "Could not reverse payment" },
        corsHeaders,
        409,
      );
    }

    await logAudit({
      supabase,
      event: "ORG_PAYMENT_REVERSED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "high",
      diag: "ORG-PAY-REV",
      metadata: {
        org_payment_id,
        reason: typeof reason === "string" ? reason.trim().slice(0, 500) : null,
      },
      req,
    });

    return respond(
      {
        success: true,
        new_balance: row?.new_balance ?? null,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("reverse-org-payment crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
