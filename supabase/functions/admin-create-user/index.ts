// supabase/functions/admin-create-user/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_ROLES = ["user", "admin", "police", "cashier"];
const ALLOWED_STATUS = ["active", "suspended", "disabled"];

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") ||
      req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    // Create users is admin-only.
    if (session.role !== "admin") {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const body = await req.json().catch(() => null);
    const {
      first_name,
      last_name,
      id_number,
      email,
      phone,
      role,
      status,
      suspended_reason,
      police_station,
    } = body ?? {};

    const fn = typeof first_name === "string" ? first_name.trim() : "";
    const ln = typeof last_name === "string" ? last_name.trim() : "";
    const idn = typeof id_number === "string"
      ? id_number.replace(/\s+/g, "").trim()
      : "";
    const em = typeof email === "string" ? email.trim().toLowerCase() : "";
    const ph = typeof phone === "string" ? phone.trim() : "";
    const rl = typeof role === "string" ? role.trim().toLowerCase() : "user";
    const stt = typeof status === "string" ? status.trim().toLowerCase() : "active";
    const reason =
      typeof suspended_reason === "string" ? suspended_reason.trim() : "";
    const st = typeof police_station === "string" ? police_station.trim() : "";

    if (!ln || !idn || !ph) {
      return respond(
        { success: false, message: "Last name, ID number, and phone are required." },
        corsHeaders,
        400,
      );
    }

    if (!ALLOWED_ROLES.includes(rl)) {
      return respond({ success: false, message: "Invalid role" }, corsHeaders, 400);
    }

    if (!ALLOWED_STATUS.includes(stt)) {
      return respond({ success: false, message: "Invalid status" }, corsHeaders, 400);
    }

    if (stt !== "active" && !reason) {
      return respond(
        { success: false, message: "A reason is required to set status to suspended/disabled." },
        corsHeaders,
        400,
      );
    }

    // Basic uniqueness checks (best-effort; DB constraints still apply).
    const { data: idExists } = await supabase
      .from("users")
      .select("id")
      .eq("id_number", idn)
      .is("deleted_at", null)
      .maybeSingle();

    if (idExists) {
      return respond(
        { success: false, message: "A user with this ID number already exists." },
        corsHeaders,
        409,
      );
    }

    if (em) {
      const { data: emailExists } = await supabase
        .from("users")
        .select("id")
        .eq("email", em)
        .is("deleted_at", null)
        .maybeSingle();

      if (emailExists) {
        return respond(
          { success: false, message: "A user with this email already exists." },
          corsHeaders,
          409,
        );
      }
    }

    // Phone must be unique.
    const { data: phoneExists } = await supabase
      .from("users")
      .select("id")
      .eq("phone", ph)
      .is("deleted_at", null)
      .maybeSingle();

    if (phoneExists) {
      return respond(
        { success: false, message: "A user with this phone number already exists." },
        corsHeaders,
        409,
      );
    }

    const { data: created, error: insErr } = await supabase
      .from("users")
      .insert({
        first_name: fn || null,
        last_name: ln,
        id_number: idn,
        email: em || null,
        phone: ph,
        role: rl,
        police_station: st || null,
        status: stt,
        suspended_reason: stt === "active" ? null : reason,
        suspended_at: stt === "active" ? null : new Date().toISOString(),
        identity_verified: false,
        email_verified: false,
      })
      .select("id, first_name, last_name, email, role, police_station")
      .single();

    if (insErr || !created) {
      return respond(
        { success: false, message: insErr?.message || "Failed to create user" },
        corsHeaders,
        500,
      );
    }

    return respond({ success: true, user: created }, corsHeaders, 200);
  } catch (err: any) {
    console.error("admin-create-user crash:", err);
    return respond(
      { success: false, message: err?.message || "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});

