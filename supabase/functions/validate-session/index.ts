// supabase/functions/validate-session/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { deriveUserStatus } from "../shared/userState.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const auth = req.headers.get("authorization") || req.headers.get("Authorization");

    if (!auth) {
      return respond(
        {
          success: false,
          diag: "VAL-SESS-001",
          message: "Authorization header missing",
        },
        corsHeaders,
        400
      );
    }

    // Slide DB expiry only — do not rotate JWT here. Rotating on every validate
    // replaces `sessions.token` and races across browser tabs sharing one token.
    const session = await validateSession(supabase, auth, { rotateJwt: false });

    if (!session) {
      return respond(
        {
          success: false,
          diag: "VAL-SESS-002",
          message: "Invalid session",
        },
        corsHeaders,
        401
      );
    }

    // Fetch user profile from public.users
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        `
        id,
        first_name,
        last_name,
        phone,
        email,
        role,
        suspended_reason,
        suspended_at,
        disabled_reason,
        disabled_at,
        deleted_at,
        identity_verified,
        is_minor,
        village,
        ward,
        police_station,
        user_credits(balance)
      `,
      )
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError || !user) {
      return respond(
        {
          success: false,
          diag: "VAL-SESS-003",
          message: "User not found",
        },
        corsHeaders,
        404
      );
    }

    // ----------------------------------
    //  Enforce account status
    // ----------------------------------
    const derived = deriveUserStatus(user);
    if (derived !== "active") {
      // revoke session immediately
      await supabase
        .from("sessions")
        .update({ revoked: true })
        .eq("id", session.id);

      return respond(
        {
          success: false,
          diag: "VAL-SESS-004",
          message: "Account is not active",
          status: derived,
        },
        corsHeaders,
        403
      );
    }

    const credit_balance =
      typeof (user as any)?.user_credits?.balance === "number"
        ? (user as any).user_credits.balance
        : 0;

    const { data: promoRows, error: promoErr } = await supabase.rpc("is_promo_active", {
      p_user_id: session.user_id,
    });
    if (promoErr) console.error("validate-session promo check:", promoErr.message);
    const promo_active = typeof promoRows === "boolean" ? promoRows : false;

    const { data: activePromo, error: promoInfoErr } = await supabase.rpc(
      "get_active_promo_for_user",
      { p_user_id: session.user_id },
    );
    if (promoInfoErr) console.error("validate-session promo info:", promoInfoErr.message);
    const promo = Array.isArray(activePromo) ? activePromo[0] : activePromo ?? null;

    const { data: lastSessionRow } = await supabase
      .from("session_last_login")
      .select("last_login_at")
      .eq("user_id", session.user_id)
      .limit(1)
      .maybeSingle();

    const last_login_at =
      typeof (lastSessionRow as any)?.last_login_at === "string"
        ? (lastSessionRow as any).last_login_at
        : null;

    const normalizedUser = {
      ...(user as any),
      credit_balance,
      last_login_at,
      promo_active,
      promo,
    };
    delete (normalizedUser as any).user_credits;

    return respond(
      {
        success: true,
        user: normalizedUser,
        session_token: session.new_token ?? null,
      },
      corsHeaders,
      200,
    );

  } catch (err) {

    return respond(
      {
        success: false,
        diag: "VAL-SESS-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});