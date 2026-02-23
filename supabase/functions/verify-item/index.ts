// supabase/functions/verify-item/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { normalizeSerial } from "../shared/serial.ts";

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
    const { serial } = await req.json();

    if (!serial || typeof serial !== "string") {
      return respond(
        { success: false, message: "Serial is required" },
        corsHeaders,
        400
      );
    }

    const cleaned = normalizeSerial(serial);

    const { data: item, error } = await supabase
      .from("items")
      .select("status")
      .or(
        `serial1_normalized.eq.${cleaned},serial2_normalized.eq.${cleaned}`
      )
      .is("deletedat", null)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!item) {
      return respond(
        {
          success: true,
          result: { state: "NOT_FOUND" },
        },
        corsHeaders,
        200
      );
    }

    if (item.status === "Stolen") {
      return respond(
        {
          success: true,
          result: { state: "STOLEN" },
        },
        corsHeaders,
        200
      );
    }

    return respond(
      {
        success: true,
        result: { state: "REGISTERED" },
      },
      corsHeaders,
      200
    );

  } catch (err) {
    console.error("verify-item crash:", err);

    return respond(
      {
        success: false,
        message: "Verification failed",
      },
      corsHeaders,
      500
    );
  }
});