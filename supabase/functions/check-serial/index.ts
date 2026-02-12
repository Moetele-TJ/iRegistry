// supabase/functions/check-serial/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { hashToken } from "../shared/crypto.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* ===================== AUTH ===================== */

    const auth = req.headers.get("authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "SERIAL-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const actorUserId = session.user_id;
    const actorRole = session.role;

    /* ===================== INPUT ===================== */

    const body = await req.json().catch(() => ({}));
    const { serial1 } = body;

    if (!serial1 || typeof serial1 !== "string") {
      return respond(
        {
          success: false,
          diag: "SERIAL-001",
          message: "Serial number is required",
        },
        corsHeaders,
        400
      );
    }

    const cleanSerial = normalizeSerial(serial1);

    if (!cleanSerial) {
      return respond(
        {
          success: false,
          diag: "SERIAL-002",
          message: "Invalid serial number format",
        },
        corsHeaders,
        400
      );
    }

    /* ===================== CHECK ===================== */

    const { data, error } = await supabase
      .from("items")
      .select("id")
      .eq("serial1_normalized", cleanSerial)
      .is("deletedat", null)
      .maybeSingle();

    if (error) throw error;

    return respond(
      {
        success: true,
        exists: !!data,
      },
      corsHeaders,
      200
    );

  } catch (err) {
    console.error("check-serial crash:", err);

    return respond(
      {
        success: false,
        diag: "SERIAL-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});