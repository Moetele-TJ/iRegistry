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
    console.log("🚀 validate-session invoked");
    const corsHeaders = getCorsHeaders(req);
    console.log("METHOD:", req.method);

    if (req.method === "OPTIONS") {
      console.log("OPTIONS returning");
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    console.log("POST reached");

    const auth = req.headers.get("authorization");

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

    return respond(
      {
        success: true,
        user_id: session.user_id,
        role: session.role,
      },
      corsHeaders,
      200
    );

  } catch (err) {
    console.error("validate-session crash:", err);

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