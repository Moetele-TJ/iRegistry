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

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const body = await req.json().catch(() => null);

  if (!body?.user_id || !body?.channel) {
    return respond({ 
      success: false, 
      diag: "AUT-ID-001",
      message: "Invalid request, check your credentials and start again.",
    });
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
    });
  }

  //check if user already has an existing valid otp before sending a new one
  const { data: existingOtp } = await supabase
    .from("login_otps")
    .select("id, expires_at, attempts")
    .eq("user_id", body.user_id)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    existingOtp &&
    new Date(existingOtp.expires_at) > new Date() &&
    existingOtp.attempts < 3
  ) {
    return respond({
      success: true,
      diag: "OTP-EXIST",
      message: "A verification code has already been sent. Please enter it.",
      reuse: true,
    });
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
      }
    )
  }

  const {error : insertError} = await supabase.from("login_otps").insert({
    user_id: body.user_id,
    otp_hash: otpHash,
    channel: body.channel,
    
    ...(body.channel ==="sms" && {contact: user.phone}),
    ...(body.channel ==="email" && {contact: user.email}),

    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  });

  if ( insertError ){
    //console.error("OTP insert failed:",insertError);
    return respond(
      {
        success : false,
        diag : "CHAN-SEND-003",
        message : "We are unable to process your request any further",
      }
    )
  }

  // 🔔 SEND OTP
  if (body.channel === "sms") {
    if (!user.phone) {
      return respond({
        success: false,
        diag: "OTP-SMS-002",
        message: "No phone number registered for this account",
      });
    }

    try {
      const result = await sendSMS(
        user.phone,
        `Your iRegistry verification code is ${otp}. It expires in 5 minutes.`
      );

      // log sms success
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

    } catch (err) {

      //log sms failure
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
      });
    }
  }

  if (body.channel === "email") {
    if (!user.email) {
      return respond({
        success: false,
        diag: "OTP-EMAIL-002",
        message: "No email registered for this account",
      });
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
      });
    }
  }

  return respond({
    success: true,
    message: "OTP sent",
  });
});