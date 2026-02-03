import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAudit } from "../shared/logAudit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const respond = (payload: unknown) =>
  new Response(JSON.stringify(payload), { headers : corsHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers : corsHeaders });

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

    return respond({
      success: false,
      message: "Missing credentials" });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, phone, email")
    .eq("last_name", body.last_name)
    .eq("id_number", body.id_number)
    .is("deleted_at",null)
    .maybeSingle();

  if (!user) {

    await logAudit({
      supabase,
      event: "OTP_REQUEST_FAILED",
      user_id: user.id,
      success: false,
      diag: "OTP-SEND-FAIL",
      req
    });

    return respond({
      success: false,
      diag: "AUT-ID-003",
      message: "We can't find a user with these credentials",
    });
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

  return respond({
    success: true,
    channels,
    user_id: user.id,
    masked_phone: user.phone
      ? user.phone.slice(0, 4) + "••••" + user.phone.slice(-3)
      : null,
    masked_email: user.email
      ? user.email[0] + "***@" + user.email.split("@")[1]
      : null,
  });
});