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

    const body = await req.json().catch(() => null);
    const action = body?.action === "revoke" ? "revoke" : "list";

    if (action === "list") {
      const { data, error } = await supabase
        .from("user_trusted_devices")
        .select("device_id, verified_at")
        .eq("user_id", session.user_id)
        .order("verified_at", { ascending: false });

      if (error) {
        console.error("user_trusted_devices list:", error.message);
        return respond({ success: false, message: "Failed to load trusted devices" }, corsHeaders, 500);
      }

      return respond({ success: true, devices: data || [] }, corsHeaders, 200);
    }

    const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
    if (deviceId.length < 8) {
      return respond({ success: false, message: "Invalid device id" }, corsHeaders, 400);
    }

    const { data: delRows, error: delErr } = await supabase
      .from("user_trusted_devices")
      .delete()
      .eq("user_id", session.user_id)
      .eq("device_id", deviceId)
      .select("device_id");

    if (delErr) {
      console.error("user_trusted_devices revoke:", delErr.message);
      return respond({ success: false, message: "Failed to remove device" }, corsHeaders, 500);
    }

    if (!delRows?.length) {
      return respond({ success: false, message: "Trusted device not found" }, corsHeaders, 404);
    }

    await logAudit({
      supabase,
      event: "TRUSTED_DEVICE_REVOKED",
      user_id: session.user_id,
      success: true,
      diag: "TRUST-DEV-REV",
      req,
    });

    return respond({ success: true, message: "This browser will need email OTP before SMS next time." }, corsHeaders, 200);
  } catch (err: unknown) {
    console.error("user-trusted-devices crash:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
