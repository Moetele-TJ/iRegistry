import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashOtp } from "../shared/crypto.ts";
import { sendSMS } from "../shared/sms.ts";
import { sendEmail } from "../shared/email.ts";
import { logAudit } from "../shared/logAudit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json",
};

const respond = (payload: unknown) =>
  new Response(JSON.stringify(payload), { headers : corsHeaders});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers : corsHeaders });

  const body = await req.json().catch(() => null);

  if (!body?.id_number || !body?.channel) {
    return respond({ 
      success: false, 
      diag: "AUT-ID-001",
      message: "Invalid request, check your credentials and start again.",
    });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("phone, email")
    .eq("id_number", body.id_number)
    .maybeSingle();

  if (userError || !user) {
    return respond({
      success: false,
      diag: "CHAN-CONT-001",
      message: "User contact details not found",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await hashOtp(otp);

  const {error : invalidateError} = await supabase
    .from("login_otps")
    .update({ used: true })
    .eq("id_number", body.id_number)
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
    id_number: body.id_number,
    otp_hash: otpHash,
    channel: body.channel,
    phone : user.phone,
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
        id_number: body.id_number,
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
        id_number: body.id_number,
        channel: "sms",
        success: false,
        diag: err?.message || "OTP-SMS-FAIL",
        req
      });

      return respond({
        success: false,
        diag: "OTP-SMS-001",
        message: err.message ||  "Failed to send OTP via SMS",
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
        id_number: body.id_number,
        channel: "email",
        success: true,
        diag: "OTP-EMAIL-OK",
        req
      });

    } catch (err) {

        await logAudit({
        supabase,
        event: "EMAIL_OTP_FAILED",
        id_number: body.id_number,
        channel: "email",
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