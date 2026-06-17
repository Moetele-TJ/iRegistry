// supabase/functions/check-user-details/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ SHARED COUNTRIES METADATA
import countries from "../../../shared/countries.json" assert { type: "json" };
import { findSignupIdentifierConflict } from "../shared/signupUniqueness.ts";
import { normalizeAgentNumber } from "../shared/referralAgentNumber.ts";
import { deriveUserStatus } from "../shared/userState.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function respondSuccess() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Success",
    }),
    { headers: corsHeaders }
  );
}

function respondError(message: string) {
  return new Response(
    JSON.stringify({
      success: false,
      message,
    }),
    { headers: corsHeaders }
  );
}

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (String(body?.mode || "").trim().toLowerCase() === "referral") {
      const raw =
        typeof body.referral_code === "string" ? body.referral_code
        : typeof body.agent_number === "string" ? body.agent_number
        : "";
      const canonical = normalizeAgentNumber(raw);

      if (!canonical) {
        return new Response(
          JSON.stringify({
            success: true,
            exists: false,
            canonical: null,
          }),
          { headers: corsHeaders },
        );
      }

      const { data: referrer, error: referrerErr } = await supabase
        .from("users")
        .select("id, agent_number, deleted_at, suspended_at, disabled_at")
        .eq("agent_number", canonical)
        .maybeSingle();

      if (referrerErr) {
        return respondError("Unable to verify referral code.");
      }

      const exists = Boolean(referrer?.id && deriveUserStatus(referrer) === "active");

      return new Response(
        JSON.stringify({
          success: true,
          exists,
          canonical,
        }),
        { headers: corsHeaders },
      );
    }

    const {
      id_number,
      email,
      phone,
      country, // country CODE e.g. "BW"
    } = body;

    // =====================================================
    // 1️⃣ ID NUMBER CHECK
    // =====================================================
    if (!id_number) {
      return respondError("An ID number is required, please type in and ID");
    }

    // =====================================================
    // 3️⃣ PHONE + COUNTRY CHECK
    // =====================================================
    if (!country) {
      return respondError("Country is required, please select a country from the list");
    }

    const countryMeta = countries.find(
      (c: any) => c.code === country
    );

    if (!countryMeta) {
      return respondError("Invalid country selection, please make a new selection");
    }

    if (!phone) {
      return respondError("Phone number is required, please enter a phone number");
    }

    // Strip non-digits
    const digitsOnly = phone.replace(/\D/g, "");

    // Remove country dial code
    const nationalNumber = digitsOnly.replace(
      countryMeta.dialCode.replace("+", ""),
      ""
    );

    const length = nationalNumber.length;

    if (
      length < countryMeta.minLength ||
      length > countryMeta.maxLength
    ) {
      return respondError(
        `Phone number must be between ${countryMeta.minLength} and ${countryMeta.maxLength} digits for ${countryMeta.name}`
      );
    }

    if (!email) {
      return respondError("Email address is required, please type in a valid email address");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return respondError("The email address you entered is Invalid");
    }

    const identifierConflict = await findSignupIdentifierConflict(supabase, {
      id_number,
      email,
      phone: phone.trim(),
    });
    if (identifierConflict) {
      return respondError(identifierConflict);
    }


    // =====================================================
    // ✅ ALL CHECKS PASSED — THIS IS THE ONLY SUCCESS MESSAGE
    // =====================================================
    return respondSuccess();


  } catch (err) {
    console.error("check-user-details error:", err);
    return respondError("Unexpected server error");
  }
});
