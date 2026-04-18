import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";
import { logAudit } from "../shared/logAudit.ts";
import { orgSlugFromNameAndId } from "../shared/orgSlug.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!isPrivilegedRole(session.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }
    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return respond({ success: false, message: "Organization name is required" }, corsHeaders, 400);
    }

    const registration_no =
      typeof body?.registration_no === "string" && body.registration_no.trim()
        ? body.registration_no.trim()
        : null;
    const contact_email =
      typeof body?.contact_email === "string" && body.contact_email.trim()
        ? body.contact_email.trim().toLowerCase()
        : null;
    const phone =
      typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    const village =
      typeof body?.village === "string" && body.village.trim() ? body.village.trim() : null;
    const ward = typeof body?.ward === "string" && body.ward.trim() ? body.ward.trim() : null;

    const { data: org, error } = await supabase
      .from("orgs")
      .insert({
        name: name.slice(0, 200),
        registration_no: registration_no ? registration_no.slice(0, 120) : null,
        contact_email: contact_email ? contact_email.slice(0, 200) : null,
        phone: phone ? phone.slice(0, 50) : null,
        village: village ? village.slice(0, 120) : null,
        ward: ward ? ward.slice(0, 120) : null,
      })
      .select("id, name, registration_no, contact_email, phone, village, ward, created_at")
      .single();

    if (error || !org) {
      console.error("create-organization insert:", error?.message);
      return respond(
        { success: false, message: error?.message || "Failed to create organization" },
        corsHeaders,
        500,
      );
    }

    const slug = orgSlugFromNameAndId(name, String(org.id));
    const { error: slugErr } = await supabase.from("orgs").update({ slug }).eq("id", org.id);
    if (slugErr) {
      console.error("create-organization slug:", slugErr?.message);
      return respond(
        { success: false, message: slugErr?.message || "Failed to set organization URL" },
        corsHeaders,
        500,
      );
    }

    const channel = roleIs(session.role, "cashier") ? "CASHIER" : "ADMIN";
    await logAudit({
      supabase,
      event: "ORG_CREATED",
      user_id: String(session.user_id),
      channel,
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "ORG-CREATE",
      metadata: { org_id: org.id, name: org.name },
      req,
    });

    return respond({ success: true, org }, corsHeaders, 200);
  } catch (err: unknown) {
    console.error("create-organization crash:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
