// supabase/functions/create-user/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ----------------------------
    // INSERT USER (NO CHECKS HERE)
    // ----------------------------
    const { error } = await supabase.from("users").insert({
      // STEP 1
      first_name: body.first_name,
      last_name: body.last_name,
      id_number: body.id_number,
      date_of_birth: body.date_of_birth,
      country: body.country,
      phone: body.phone,
      email: body.email,

      // STEP 2
      state: body.state || null,
      city: body.city || null,
      postal_code: body.postal_code || null,
      address_line: body.address_line || null,
      alt_phone: body.alt_phone || null,
      landline: body.landline || null,
      police_station: body.police_station || null,

      // SYSTEM FIELDS
      role: "user",
      status: "active",
      identity_verified: false,
      email_verified: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created successfully",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("create-user error:", err);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Unexpected server error",
      }),
      { status: 200, headers: corsHeaders }
    );
  }
});