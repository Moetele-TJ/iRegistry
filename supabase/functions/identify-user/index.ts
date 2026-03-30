// supabase/functions/identify-user/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAudit } from "../shared/logAudit.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => null);

  if (!body?.last_name || !body?.id_number) {

    await logAudit({
      supabase,
      event: "OTP_MISSING_CREDENTIALS",
      id_number: "MISSING",
      success: false,
      diag: "OTP-SEND-FAIL",
      req
    });

    return respond(
      {
        success: false,
        message: "Missing credentials"
      },
      corsHeaders,
      400
    );
  }

  const lastName = body.last_name?.trim();
  const ID = body.id_number?.replace(/\s+/g, "").trim();

  const { data: user, error: identityError } = await supabase
    .from("users")
    .select("id, phone, email")
    .eq("last_name", lastName)
    .eq("id_number", ID)
    .is("deleted_at",null)
    .maybeSingle();

  if (identityError) {

     return respond(
      {
        success: false,
        diag: "AUT-ID-003",
        message: "We can not process your request, please contact your System Administrator",
      },
      corsHeaders,
      500
    );
  }

  if (!user) {

    await logAudit({
      supabase,
      event: "OTP_REQUEST_FAILED",
      user_id: ID,
      success: false,
      diag: "OTP-SEND-FAIL",
      req
    });

    return respond(
      {
        success: false,
        diag: "AUT-ID-NOT-FOUND",
        message: "No such user found. Please check your last name and ID number.",
      },
      corsHeaders,
      200
    );
  }

  const channels = [];
  if (user.phone) channels.push("sms");
  if (user.email) channels.push("email");

  await logAudit({
    supabase,
    event: "OTP_REQUEST_SUCCESS",
    user_id: user.id,
    success: true,
    diag: "OTP-SEND-OK",
    req
  });

  return respond(
    {
      success: true,
      channels,
      user_id: user.id,
      masked_phone: user.phone
        ? user.phone.slice(0, 4) + "••••" + user.phone.slice(-3)
        : null,
      masked_email: user.email
        ? user.email[0] + "***@" + user.email.split("@")[1]
        : null,
    },
    corsHeaders,
    200
  );
});