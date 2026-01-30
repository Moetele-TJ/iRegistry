
//supabase/verify-otp/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { hashOtp, hashToken } from "../shared/crypto.ts";
import { logAudit } from "../shared/logAudit.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

// --------------------------------------
// SUPABASE CLIENT
// --------------------------------------
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// --------------------------------------
// MAIN FUNCTION
// --------------------------------------
serve(async (req) => {

  //console.log("VERIFY-OTP HIT:",req.method);

  const corsHeaders = getCorsHeaders(req);

  // 🔥 1️⃣ Preflight — ALWAYS FIRST
  if (req.method === "OPTIONS") {
    //console.log("VERIFY-OTP OPTIONS");
    return new Response(
      null,{
        status: 204,
        headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => null);

    // ----------------------------------
    // BASIC INPUT VALIDATION
    // ----------------------------------
    if (!body?.id_number || !body?.otp) {
      return respond({
        code: "1",
        success: false,
        diag : "OTP-VFY-001",
        message: "ID number and OTP are required",
      },
      corsHeaders,
      400
    );
    }

    if (body.otp.length !== 6) {
      return respond({
        code:"1",
        success: false,
        diag : "OTP-VFY-002",
        message: "A valid OTP should be 6-digits",
      },
      corsHeaders,
      400
    );
    }

    // ----------------------------------
    // FETCH LATEST VALID OTP
    // ----------------------------------
    const { data: otpRecord, error: otpError } = await supabase
      .from("login_otps")
      .select("id, otp_hash, expires_at, attempts")
      .eq("id_number", body.id_number)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // DEBUG (safe, no secrets)
    console.log("DEBUG OTP lookup:", {
      otpFound: !!otpRecord,
      otpError,
    });

    // ----------------------------------
    // HANDLE DB FAILURE
    // ----------------------------------
    if (otpError) {
      return respond({
        code: "1",
        success: false,
        diag : "SYS-VFY-002",
        message : "Unexpected server response. Please try again",
      },
      corsHeaders,
      500
    );
    }

    if (otpRecord?.attempts >= 3) {

      await supabase
        .from("login_otps")
        .update({ used : true })
        .eq("id", otpRecord.id);

      await logAudit({
        supabase,
        event: "OTP_LOCKED",
        id_number: body.id_number,
        success: false,
        diag: "OTP-LOCK",
        req
      });

      return respond({
        code:"2",
        success:false,
        diag:"OTP-VFY-LOCK",
        message:"Too many attempts. Request new OTP."
      },
    corsHeaders,
    429
    );
    }

    // ----------------------------------
    // OTP NOT FOUND / EXPIRED
    // ----------------------------------
    if (!otpRecord || new Date(otpRecord.expires_at) < new Date()) {

      if (otpRecord) {
        await supabase
          .from("login_otps")
          .update({ used: true })
          .eq("id", otpRecord.id);
      }

      await logAudit({
        supabase,
        event: "OTP_INVALID",
        id_number: body.id_number,
        success: false,
        diag: "OTP-INVALID/EXPIRED",
        req
      });

      return respond({
        code:"1",
        success: false,
        diag : "OTP-VFY-003",
        message: "OTP is invalid or has expired",
      },
      corsHeaders,
      400
    );
    }

    // ----------------------------------
    // HASH & COMPARE OTP
    // ----------------------------------
    const incomingHash = await hashOtp(body.otp);

    if (incomingHash !== otpRecord.otp_hash) {

      await supabase
      .from("login_otps")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

      await logAudit({
        supabase,
        event: "OTP_VERIFY_FAILURE",
        id_number: body.id_number,
        success: false,
        diag: "OTP-VFY-FAIL",
        req
      });

      return respond({
        code: "1",
        success: false,
        diag : "OTP-VFY-004",
        message: "Invalid OTP",
      },
      corsHeaders,
      400
    );
    }

    // ----------------------------------
    // MARK OTP AS USED (ANTI-REPLAY)
    // ----------------------------------
    const {  error: serverError } = await supabase
      .from("login_otps")
      .update({ used: true })
      .eq("id", otpRecord.id);

      if (serverError){

        return respond({
        code: "1",
        success: false,
        diag : "OTP-VFY-005",
        message: "Technical error! Please try again.",
      },
      corsHeaders,
      500
    );

      }

    // ----------------------------------
    // FETCH USER ROLE
    // ----------------------------------
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id_number", body.id_number)
      .maybeSingle();

    if (userError || !user) {
      return respond({
        code: "2",
        success: false,
        diag : "AUTH-VRY-001",
        message: "We are unable to complete your login, please try again",
      },
      corsHeaders,
      500
    );
    }

    //-----------------------------------
    //BEFORE CREATING A NEW SESSION REVOKE
    //ALL EXISTING ONES
    //-----------------------------------
    await supabase
      .from("sessions")
      .update({ revoked:true })
      .eq("user_id", body.id_number);

    //-----------------------------------
    // Create Session
    //-----------------------------------
    const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

    if (!JWT_SECRET) {
      return respond({
        code: "2",
        success:false,
        diag:"SESS-CONFIG-001",
        message:"Server misconfiguration. Contact administrator."
      },
      corsHeaders,
      500
    );
    }

    const payload = {
      sub: body.id_number,
      role: user.role,
      exp: getNumericDate(60 * 60), // 1 hour
    };

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const token = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key
    );

    const tokenHash = await hashToken(token);

     //-----------------------------------
    //SAVE SESSION
    //-----------------------------------
    const {error : sessionError} = await supabase.from("sessions").insert({
      user_id: body.id_number,
      role: user.role,
      token: tokenHash,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    if (sessionError){
      return respond({
        code: "2",
        success: false,
        diag : "SESS-SAV-001",
        message: "We are unable to create your Session, please try again",
      },
      corsHeaders,
      500
    );
    }

    //log verify success
    await logAudit({
      supabase,
      event: "SESSION_CREATED",
      id_number: body.id_number,
      success: true,
      diag: "SESS-OK",
      req
    });

    // ----------------------------------
    // SUCCESS RESPONSE
    // ----------------------------------
    return respond({
      success: true,
      role: user.role, // user | police | admin
      session_token: token,
      },
      corsHeaders,
      200
    );

  }
  catch (err) {
    console.error("verify-otp crash:", err);
    return respond({
      success: false,
      diag : "SYS-VFY-001",
      message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});