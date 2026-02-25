// supabase/functions/validate-session/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

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

    const session = await validateSession(supabase, auth);

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
      .select(`
        id,
        first_name,
        last_name,
        email,
        role,
        status,
        identity_verified,
        is_minor,
        police_station,
        last_login_at
      `)
      .eq("id", session.user_id)
      .is("deleted_at", null)
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
    if (user.status !== "active") {
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
        },
        corsHeaders,
        403
      );
    }

    return respond(
      {
        success: true,
        user,
      },
      corsHeaders,
      200
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