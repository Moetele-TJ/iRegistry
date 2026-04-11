// supabase/functions/dispatch-otp/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashOtp } from "../shared/crypto.ts";
import { sendSMS } from "../shared/sms.ts";
import { sendEmail } from "../shared/email.ts";
import { logAudit } from "../shared/logAudit.ts";
import { getCorsHeaders} from "../shared/cors.ts";
import { respond} from "../shared/respond.ts";
import { checkRateLimit, recordAttempt } from "../shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  const body = await req.json().catch(() => null);

  if (!body?.user_id || !body?.channel) {
    return respond({ 
        success: false, 
        diag: "AUT-ID-001",
        message: "Invalid request, check your credentials and start again.",
      },
      corsHeaders,
      400
    );
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("phone, email")
    .eq("id", body.user_id)
    .maybeSingle();

  if (userError || !user) {
    return respond({
        success: false,
        diag: "CHAN-CONT-001",
        message: "User contact details not found",
      },
      corsHeaders,
      400
    );
  }

  const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
  const deviceName = typeof body?.device_name === "string" ? body.device_name.trim() : "";

  const hasEmail = !!(user.email && String(user.email).trim());
  const hasPhone = !!(user.phone && String(user.phone).trim());
  const phoneOnly = hasPhone && !hasEmail;

  // SMS costs money: only after this browser completed email OTP once (trusted device),
  // unless the account has no email (SMS is the only option).
  if (body.channel === "sms" && hasEmail) {
    if (deviceId.length < 8) {
      return respond(
        {
          success: false,
          diag: "SMS-TRUST-002",
          message:
            "Use email to verify on this device first. If the problem persists, refresh the page and try again.",
        },
        corsHeaders,
        400,
      );
    }
    const { data: trustRow } = await supabase
      .from("user_trusted_devices")
      .select("user_id")
      .eq("user_id", body.user_id)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (!trustRow) {
      return respond(
        {
          success: false,
          diag: "SMS-TRUST-001",
          message:
            "On new devices, sign in with email first (free). After that, SMS is available on this device.",
        },
        corsHeaders,
        403,
      );
    }
  }

  // Check if user already has an existing valid OTP before sending a new one.
  // IMPORTANT: Only reuse when the OTP was generated for THIS device.
  // Otherwise, a user logging in on a second device could be blocked from receiving an OTP.
  const { data: existingOtp } = await supabase
    .from("login_otps")
    .select("id, expires_at, attempts, channel, device_id")
    .eq("user_id", body.user_id)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    existingOtp &&
    new Date(existingOtp.expires_at) > new Date() &&
    existingOtp.attempts < 3 &&
    deviceId &&
    String(existingOtp.device_id || "") === deviceId
  ) {
    return respond({
        success: true,
        diag: "OTP-EXIST",
        message: "A verification code has already been sent to this device. Please enter it.",
        reuse: true,
      },
      corsHeaders,
      200
    );
  }

  /** Tighter IP cap when sending a new SMS for phone-only accounts (not for OTP reuse). */
  if (body.channel === "sms" && phoneOnly) {
    const allowed = await checkRateLimit(supabase, {
      ip,
      action: "dispatch_sms_phone_only",
      limit: 6,
      windowSeconds: 3600,
    });
    if (!allowed) {
      return respond(
        {
          success: false,
          diag: "RATE-DISPATCH-SMS-P",
          message:
            "Too many SMS code requests from this network. Please wait and try again later.",
        },
        corsHeaders,
        429,
      );
    }
  }

  // =============create an OTP=====================
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await hashOtp(otp);

  const {error : invalidateError} = await supabase
    .from("login_otps")
    .update({ used: true })
    .eq("user_id", body.user_id)
    .eq("used", false);

  if (invalidateError){
    return respond(
      {
        success: false,
        diag: "CHAN-SEND-002",
        message: "We are unable to process your request. Please try again",
      },
      corsHeaders,
      500
    );
  }

  const { data: otpRow, error: insertError } = await supabase
    .from("login_otps")
    .insert({
      user_id: body.user_id,
      otp_hash: otpHash,
      channel: body.channel,
      device_id: deviceId || null,
      device_name: deviceName || null,

      ...(body.channel === "sms" && { contact: user.phone }),
      ...(body.channel === "email" && { contact: user.email }),

      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    })
    .select("id")
    .single();

  if (insertError || !otpRow?.id) {
    return respond(
      {
        success: false,
        diag: "CHAN-SEND-003",
        message: "We are unable to process your request any further",
      },
      corsHeaders,
      500
    );
  }

  // 🔔 SEND OTP (SMS) — debit credits before provider send; refund if send fails.
  if (body.channel === "sms") {

    if (!user.phone) {
      await supabase.from("login_otps").update({ used: true }).eq("id", otpRow.id);
      return respond({
        success: false,
        diag: "OTP-SMS-002",
        message: "No phone number registered for this account",
      },
      corsHeaders,
      400
      );
    }

    const { data: spendRows, error: spendRpcErr } = await supabase.rpc("spend_credits", {
      p_user_id: body.user_id,
      p_task_code: "SMS_LOGIN_OTP",
      p_reference: String(otpRow.id),
      p_metadata: { channel: "sms" },
    });

    const spend = spendRows?.[0] as
      | { success?: boolean; new_balance?: number; message?: string }
      | undefined;

    if (
      spendRpcErr ||
      !spend?.success
    ) {
      await supabase.from("login_otps").update({ used: true }).eq("id", otpRow.id);
      const msg = String(spend?.message || "");
      const insufficient = msg.toLowerCase().includes("insufficient");
      return respond(
        {
          success: false,
          diag: "SMS-OTP-BILL",
          message: insufficient
            ? "Not enough credits to send an SMS code. Add credits or sign in with email (free) if available."
            : spend?.message || "Could not debit credits for SMS.",
          billing: { required: true, task_code: "SMS_LOGIN_OTP" },
        },
        corsHeaders,
        402,
      );
    }

    const { data: costRow } = await supabase
      .from("task_catalog")
      .select("credits_cost")
      .eq("code", "SMS_LOGIN_OTP")
      .eq("active", true)
      .maybeSingle();
    const smsCost = typeof costRow?.credits_cost === "number" ? costRow.credits_cost : 1;

    try {

      const domain = new URL(req.headers.get("origin") || "https://iregistrysys.com").hostname;

      const smsMessage =
        `Your iRegistry login code is ${otp}.
  Do not share this code with anyone.

@${domain} #${otp}`;

      const result = await sendSMS(
        user.phone,
        smsMessage
      );

      console.log("SMS sent:", result);

      await logAudit({
        supabase,
        event: "OTP_SENT",
        user_id: body.user_id,
        channel: body.channel,
        success: true,
        diag: "OTP-SENT-OK",
        req
      });

      if (phoneOnly) {
        await recordAttempt(supabase, { ip, action: "dispatch_sms_phone_only" });
      }

    } catch (err: any) {

      await supabase.rpc("add_credits", {
        p_user_id: body.user_id,
        p_amount: smsCost,
        p_reference: `sms_otp_refund:${otpRow.id}`,
        p_metadata: { reason: "sms_send_failed" },
      });

      await supabase.from("login_otps").update({ used: true }).eq("id", otpRow.id);

      await logAudit({
        supabase,
        event: "SMS_SEND_FAILED",
        user_id: body.user_id,
        channel: body.channel,
        success: false,
        diag: err?.message || "OTP-SMS-FAIL",
        req
      });

      return respond({
        success: false,
        diag: "OTP-SMS-001",
        message: "Failed to send OTP via SMS",
      },
      corsHeaders,
      500
      );
    }
  }

  if (body.channel === "email") {
    if (!user.email) {
        return respond({
          success: false,
          diag: "OTP-EMAIL-002",
          message: "No email registered for this account",
        },
        corsHeaders,
        400
      );
    }

    try {
      await sendEmail(
        user.email,
        otp
      );

      await logAudit({
        supabase,
        event: "EMAIL_OTP_SENT",
        user_id: body.user_id,
        channel: body.channel,
        success: true,
        diag: "OTP-EMAIL-OK",
        req
      });

    } catch (err) {

        await logAudit({
        supabase,
        event: "EMAIL_OTP_FAILED",
        user_id: body.user_id,
        channel: body.channel,
        success: false,
        diag: "OTP-EMAIL-FAIL",
        req,
      });

      return respond({
          success: false,
          diag: "OTP-EMAIL-001",
          message: "Failed to send OTP via email",
        },
        corsHeaders,
        500
      );
    }
  }

  return respond({
      success: true,
      message: "OTP sent",
    },
    corsHeaders,
    200
  );
});