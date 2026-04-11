// supabase/functions/identify-user/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAudit } from "../shared/logAudit.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { checkRateLimit, recordAttempt } from "../shared/rateLimit.ts";

/** Stricter cap for accounts with phone but no email (SMS-only login path). */
const PHONE_ONLY_IDENTIFY_LIMIT = 10;
const PHONE_ONLY_IDENTIFY_WINDOW_SEC = 3600;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => null);

  if (!body?.last_name || !body?.id_number) {

    await logAudit({
      supabase,
      event: "OTP_MISSING_CREDENTIALS",
      id_number: "MISSING",
      success: false,
      diag: "OTP-SEND-FAIL",
      req
    });

    return respond(
      {
        success: false,
        message: "Missing credentials"
      },
      corsHeaders,
      400
    );
  }

  const lastName = body.last_name?.trim();
  const ID = body.id_number?.replace(/\s+/g, "").trim();

  const { data: user, error: identityError } = await supabase
    .from("users")
    .select("id, phone, email")
    .eq("last_name", lastName)
    .eq("id_number", ID)
    .is("deleted_at",null)
    .maybeSingle();

  if (identityError) {

     return respond(
      {
        success: false,
        diag: "AUT-ID-003",
        message: "We can not process your request, please contact your System Administrator",
      },
      corsHeaders,
      500
    );
  }

  if (!user) {

    await logAudit({
      supabase,
      event: "OTP_REQUEST_FAILED",
      user_id: ID,
      success: false,
      diag: "OTP-SEND-FAIL",
      req
    });

    return respond(
      {
        success: false,
        diag: "AUT-ID-NOT-FOUND",
        message: "No such user found. Please check your last name and ID number.",
      },
      corsHeaders,
      200
    );
  }

  const deviceId =
    typeof body.device_id === "string" ? body.device_id.trim() : "";
  let deviceTrusted = false;
  if (deviceId.length >= 8) {
    const { data: trustRow } = await supabase
      .from("user_trusted_devices")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .maybeSingle();
    deviceTrusted = !!trustRow;
  }

  const hasPhone = !!(user.phone && String(user.phone).trim());
  const hasEmail = !!(user.email && String(user.email).trim());

  /** Full channel list before trusted-device policy. */
  const channels: string[] = [];
  if (hasPhone) channels.push("sms");
  if (hasEmail) channels.push("email");

  /**
   * New / unrecognized browsers must prove control of email before SMS (reduces ID+name-only SMS abuse).
   * Exception: accounts with phone but no email cannot use email — allow SMS only.
   */
  let channelsFiltered = [...channels];
  if (!deviceTrusted) {
    if (hasEmail) {
      channelsFiltered = channelsFiltered.filter((c) => c === "email");
    } else if (hasPhone) {
      channelsFiltered = ["sms"];
    } else {
      channelsFiltered = [];
    }
  }

  if (channelsFiltered.length === 0) {
    return respond(
      {
        success: false,
        diag: "AUT-ID-NO-CHANNEL",
        message:
          "This account has no phone or email on file. Contact support to restore access.",
      },
      corsHeaders,
      200
    );
  }

  const phoneOnlyNoEmail = hasPhone && !hasEmail;
  if (phoneOnlyNoEmail) {
    const allowed = await checkRateLimit(supabase, {
      ip,
      action: "identify_user_phone_only",
      limit: PHONE_ONLY_IDENTIFY_LIMIT,
      windowSeconds: PHONE_ONLY_IDENTIFY_WINDOW_SEC,
    });
    if (!allowed) {
      return respond(
        {
          success: false,
          diag: "RATE-IDENTIFY-P",
          message:
            "Too many sign-in attempts from this network. Please wait and try again later.",
        },
        corsHeaders,
        429,
      );
    }
    await recordAttempt(supabase, { ip, action: "identify_user_phone_only" });
  }

  await logAudit({
    supabase,
    event: "OTP_REQUEST_SUCCESS",
    user_id: user.id,
    success: true,
    diag: "OTP-SEND-OK",
    req
  });

  return respond(
    {
      success: true,
      channels: channelsFiltered,
      /** When false, this browser must use email first (if available) before SMS is offered. */
      device_trusted: deviceTrusted,
      /** True when account has no email — only SMS is possible on an untrusted device. */
      phone_only_no_email: !hasEmail && hasPhone,
      user_id: user.id,
      masked_phone: user.phone
        ? user.phone.slice(0, 4) + "••••" + user.phone.slice(-3)
        : null,
      masked_email: user.email
        ? user.email[0] + "***@" + user.email.split("@")[1]
        : null,
    },
    corsHeaders,
    200
  );
});