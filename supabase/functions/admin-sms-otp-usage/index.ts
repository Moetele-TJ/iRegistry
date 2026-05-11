import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { roleIs } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function clampDays(raw: unknown) {
  const x = Math.floor(Number(raw));
  if (!Number.isFinite(x)) return 30;
  return Math.min(Math.max(x, 1), 365);
}

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
    if (!roleIs(session.role, "admin")) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const body = await req.json().catch(() => ({}));
    const days = clampDays(body?.days);
    const rawUserId = body?.user_id;
    const pUserId = isUuid(rawUserId) ? rawUserId : null;

    const { data, error } = await supabase.rpc("admin_sms_otp_usage_stats", {
      p_days: days,
      p_user_id: pUserId,
    });

    if (error) {
      return respond(
        { success: false, message: error.message || "Failed to load SMS OTP usage" },
        corsHeaders,
        500,
      );
    }

    let parsed: Record<string, unknown> = {};
    if (data == null) {
      parsed = {};
    } else if (typeof data === "string") {
      try {
        parsed = JSON.parse(data) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    } else if (typeof data === "object" && !Array.isArray(data)) {
      parsed = data as Record<string, unknown>;
    }

    return respond(
      {
        success: true,
        days: parsed.days,
        filter_user_id: parsed.filter_user_id ?? null,
        totals: parsed.totals,
        by_day: parsed.by_day,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("admin-sms-otp-usage:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected error" },
      corsHeaders,
      500,
    );
  }
});
