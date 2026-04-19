
//supabase/functions/verify-otp/index.ts
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
    if (!body?.user_id || !body?.otp) {
      return respond({
        code: "1",
        success: false,
        diag : "OTP-VFY-001",
        message: "User ID and OTP are required",
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
      .select("id, otp_hash, expires_at, attempts, channel")
      .eq("user_id", body.user_id)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
        user_id: body.user_id,
        success: false,
        diag: "OTP-LOCK",
        req
      });

      return respond({
        code:"2",
        success:false,
        diag:"OTP-VFY-LOCK",
        message:"Too many wrong attempts. Please request a new verification code."
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
        user_id: body.user_id,
        success: false,
        diag: "OTP-INVALID/EXPIRED",
        req
      });

      const expired =
        !!otpRecord && new Date(otpRecord.expires_at) < new Date();

      return respond({
        code: "1",
        success: false,
        diag: "OTP-VFY-003",
        message: expired
          ? "This code has expired. Please request a new one."
          : "No active verification code. Please request a new one.",
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

      const newAttempts = otpRecord.attempts + 1;
      const attemptsRemaining = Math.max(0, 3 - newAttempts);

      await supabase
      .from("login_otps")
      .update({ attempts: newAttempts })
      .eq("id", otpRecord.id);

      await logAudit({
        supabase,
        event: "OTP_VERIFY_FAILURE",
        user_id: body.user_id,
        success: false,
        diag: "OTP-VFY-FAIL",
        req
      });

      const message =
        attemptsRemaining > 0
          ? `That code isn't correct. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} left before this code is locked.`
          : "That code isn't correct. One more failed attempt will lock this code—request a new one if you need to.";

      return respond({
        code: "1",
        success: false,
        diag : "OTP-VFY-004",
        message,
        attempts_remaining: attemptsRemaining,
      },
      corsHeaders,
      400
    );
    }

    // NOTE: We mark OTP as used only after we successfully create a session.
    // This allows a user who hits the "2 device limit" to revoke an existing session
    // and retry with the same OTP within its expiry window.

    // ----------------------------------
    // FETCH USER ROLE
    // ----------------------------------
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", body.user_id)
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

    // ----------------------------------
    // LIMIT PARALLEL SESSIONS (max 2)
    // ----------------------------------
    const MAX_PARALLEL_SESSIONS = 2;
    const nowIso = new Date().toISOString();

    const { data: activeSessions, error: activeErr } = await supabase
      .from("sessions")
      .select("id, created_at, expires_at, ip_address, user_agent, device_id, device_name")
      .eq("user_id", body.user_id)
      .eq("revoked", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false });

    if (activeErr) {
      return respond(
        {
          code: "2",
          success: false,
          diag: "SESS-LIST-001",
          message: "We are unable to verify your active sessions. Please try again.",
        },
        corsHeaders,
        500,
      );
    }

    const sessions = Array.isArray(activeSessions) ? activeSessions : [];

    // If user has >=2 active sessions, require them to revoke one (or more) to proceed.
    if (sessions.length >= MAX_PARALLEL_SESSIONS) {
      const revokeId = typeof body?.revoke_session_id === "string" ? body.revoke_session_id : "";

      if (!revokeId) {
        return respond(
          {
            code: "2",
            success: false,
            diag: "SESS-LIMIT",
            message:
              "You are already logged in on 2 devices. Revoke one session to continue logging in here.",
            sessions,
            max_parallel: MAX_PARALLEL_SESSIONS,
          },
          corsHeaders,
          409,
        );
      }

      // Revoke the chosen session (must belong to the same user).
      const { data: revokedRow, error: revokeErr } = await supabase
        .from("sessions")
        .update({ revoked: true })
        .eq("id", revokeId)
        .eq("user_id", body.user_id)
        .eq("revoked", false)
        .select("id")
        .maybeSingle();

      if (revokeErr) {
        return respond(
          {
            code: "2",
            success: false,
            diag: "SESS-REVOKE-001",
            message: "Failed to revoke the selected session. Please try again.",
          },
          corsHeaders,
          500,
        );
      }

      if (!revokedRow) {
        return respond(
          {
            code: "2",
            success: false,
            diag: "SESS-REVOKE-002",
            message: "That session could not be revoked (it may have already expired). Please refresh and try again.",
          },
          corsHeaders,
          409,
        );
      }
    }

    //-----------------------------------
    // Create Session
    //-----------------------------------

    const sessionId = crypto.randomUUID();

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

    const now = Math.floor(Date.now() / 1000);

    const payload = {
      iss: "iregsys",
      aud: "authenticated",
      sub: user.id,             // user UUID
      role: user.role,          // from DB
      sid: sessionId,          // session UUID from sessions table
      iat: now,
      exp: now + 3600,          // 1 hour
      ver: 1
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
    const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
    const deviceName = typeof body?.device_name === "string" ? body.device_name.trim() : "";

    const {error : sessionError} = await supabase.from("sessions").insert({
      user_id: body.user_id,
      id: sessionId,
      role: user.role,
      token: tokenHash,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      device_id: deviceId || null,
      device_name: deviceName || null,
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

    // Email OTP can mark this browser as trusted (SMS allowed here next time). User may opt out
    // (e.g. shared computer) via trust_device: false — omitted/true preserves previous default behavior.
    const trustDeviceRequested = body?.trust_device !== false;
    if (
      trustDeviceRequested &&
      otpRecord.channel === "email" &&
      deviceId.length >= 8
    ) {
      const { error: trustErr } = await supabase.from("user_trusted_devices").upsert(
        {
          user_id: body.user_id,
          device_id: deviceId,
          verified_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );
      if (trustErr) {
        console.error("user_trusted_devices upsert:", trustErr);
      }
    }

    // ----------------------------------
    // MARK OTP AS USED (ANTI-REPLAY) — after session is created
    // ----------------------------------
    const { data: usedOtp, error: serverError } = await supabase
      .from("login_otps")
      .update({ used: true })
      .eq("id", otpRecord.id)
      .eq("used", false) // 🔒 atomic guard
      .select("id")
      .maybeSingle();

    if (serverError) {
      return respond(
        {
          code: "1",
          success: false,
          diag: "OTP-VFY-005",
          message: "Technical error! Please try again.",
        },
        corsHeaders,
        500,
      );
    }

    if (!usedOtp) {
      return respond(
        {
          code: "1",
          success: false,
          diag: "OTP-VFY-RACE",
          message: "OTP already used. Please request a new one.",
        },
        corsHeaders,
        409,
      );
    }

    //log verify success
    await logAudit({
      supabase,
      event: "SESSION_CREATED",
      user_id: body.user_id,
      success: true,
      diag: "SESS-OK",
      req
    });

    // ----------------------------------
    // SUCCESS RESPONSE
    // ----------------------------------
    return respond({
      success: true,
      user_id: body.user_id,
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