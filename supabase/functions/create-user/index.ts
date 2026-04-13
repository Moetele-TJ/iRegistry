// supabase/functions/create-user/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, recordAttempt } from "../shared/rateLimit.ts";
import { logUserActivity } from "../shared/logUserActivity.ts";

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

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    await recordAttempt(supabase, { ip, action: "create_user" });
    const allowed = await checkRateLimit(supabase, {
      ip,
      action: "create_user",
      limit: 10,
      windowSeconds: 60 * 10,
    });

    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Too many signup attempts. Please try again later.",
        }),
        { status: 429, headers: corsHeaders },
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const id_number =
      typeof body.id_number === "string" ? body.id_number.replace(/\s+/g, "").trim() : "";

    if (!email || !id_number) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields.",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    // ----------------------------
    // INSERT USER (public signup)
    // ----------------------------
    // Support new fields:
    // - village (formerly city)
    // - ward (formerly address_line)
    const village =
      typeof body.village === "string" ? body.village.trim()
      : typeof body.city === "string" ? body.city.trim()
      : null;
    const ward =
      typeof body.ward === "string" ? body.ward.trim()
      : typeof body.address_line === "string" ? body.address_line.trim()
      : null;

    const { data: created, error } = await supabase
      .from("users")
      .insert({
        // STEP 1
        first_name: body.first_name?.trim() || null,
        last_name: body.last_name?.trim(),
        id_number,
        date_of_birth: body.date_of_birth || null,
        country: body.country?.trim() || null,
        phone: body.phone?.trim() || null,
        email: email || null,

        // STEP 2
        state: body.state?.trim() || null,
        city: body.city?.trim() || null,
        postal_code: body.postal_code?.trim() || null,
        address_line: body.address_line?.trim() || null,
        village,
        ward,
        alt_phone: body.alt_phone?.trim() || null,
        landline: body.landline?.trim() || null,
        police_station: body.police_station?.trim() || null,

        // SYSTEM
        role: "user",
        status: "active",
        identity_verified: false,
        email_verified: false,
        created_at: new Date().toISOString(),
      })
      .select("id, first_name, last_name, email")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const displayName =
      [created.first_name, created.last_name].filter(Boolean).join(" ").trim() ||
      String(created.email || "").trim() ||
      "New user";
    await logUserActivity(supabase, {
      actorId: String(created.id),
      actorRole: "user",
      targetUserId: String(created.id),
      targetDisplayName: displayName,
      action: "USER_CREATED",
      message: "Self-registration completed",
      metadata: { source: "public_signup" },
    });

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
      { status: 500, headers: corsHeaders }
    );
  }
});