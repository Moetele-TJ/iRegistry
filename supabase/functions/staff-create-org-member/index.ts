import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { orgRoleIs } from "../shared/orgAuth.ts";
import { logOrgItemActivity } from "../shared/logOrgItemActivity.ts";

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

    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    const orgRole = typeof body?.org_role === "string" ? body.org_role.trim().toUpperCase() : "ORG_MEMBER";

    const first_name = typeof body?.first_name === "string" ? body.first_name.trim() : "";
    const last_name = typeof body?.last_name === "string" ? body.last_name.trim() : "";
    const id_number =
      typeof body?.id_number === "string" ? body.id_number.replace(/\s+/g, "").trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const date_of_birth = typeof body?.date_of_birth === "string" ? body.date_of_birth.trim() : "";
    const village = typeof body?.village === "string" ? body.village.trim() : "";
    const ward = typeof body?.ward === "string" ? body.ward.trim() : "";

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!orgRoleIs(orgRole, "ORG_ADMIN", "ORG_MANAGER", "ORG_MEMBER")) {
      return respond({ success: false, message: "Invalid org_role" }, corsHeaders, 400);
    }

    // Required fields to create a user in this app (see admin-create-user notes).
    if (!last_name || !id_number || !phone) {
      return respond(
        { success: false, message: "Last name, ID number, and phone are required." },
        corsHeaders,
        400,
      );
    }
    if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
      return respond({ success: false, message: "Invalid date of birth (use YYYY-MM-DD)." }, corsHeaders, 400);
    }

    // Ensure org exists (best-effort).
    const { data: orgRow } = await supabase.from("orgs").select("id, name").eq("id", orgId).maybeSingle();
    if (!orgRow) return respond({ success: false, message: "Organization not found" }, corsHeaders, 404);

    // Charge org wallet for ADD_MEMBER.
    const { data: spendRows, error: spendErr } = await supabase.rpc("spend_org_credits", {
      p_org_id: orgId,
      p_task_code: "ADD_MEMBER",
      p_reference: id_number,
      p_metadata: { kind: "staff-create-org-member" },
      p_created_by: session.user_id,
    });
    if (spendErr) {
      const em = String(spendErr.message || "");
      return respond(
        { success: false, message: em.includes("INSUFFICIENT_CREDITS") ? "Insufficient credits" : "Billing failed" },
        corsHeaders,
        em.includes("INSUFFICIENT_CREDITS") ? 402 : 500,
      );
    }
    const ok = Array.isArray(spendRows) ? spendRows[0]?.success : null;
    if (ok !== true) {
      return respond({ success: false, message: "Insufficient credits", billing: { required: true, task_code: "ADD_MEMBER" } }, corsHeaders, 402);
    }

    // Best-effort uniqueness checks (DB constraints still apply).
    const { data: idExists } = await supabase.from("users").select("id").eq("id_number", id_number).is("deleted_at", null).maybeSingle();
    if (idExists) return respond({ success: false, message: "A user with this ID number already exists." }, corsHeaders, 409);
    const { data: phoneExists } = await supabase.from("users").select("id").eq("phone", phone).is("deleted_at", null).maybeSingle();
    if (phoneExists) return respond({ success: false, message: "A user with this phone number already exists." }, corsHeaders, 409);
    if (email) {
      const { data: emailExists } = await supabase.from("users").select("id").eq("email", email).is("deleted_at", null).maybeSingle();
      if (emailExists) return respond({ success: false, message: "A user with this email already exists." }, corsHeaders, 409);
    }

    const { data: created, error: insErr } = await supabase
      .from("users")
      .insert({
        first_name: first_name || null,
        last_name,
        id_number,
        email: email || null,
        phone,
        date_of_birth: date_of_birth || null,
        village: village || null,
        ward: ward || null,
        role: "user",
        status: "active",
        identity_verified: false,
        email_verified: false,
      })
      .select("id, first_name, last_name, email, phone, id_number")
      .single();

    if (insErr || !created) {
      return respond({ success: false, message: insErr?.message || "Failed to create user" }, corsHeaders, 500);
    }

    const nowIso = new Date().toISOString();
    const { data: mem, error: memErr } = await supabase
      .from("org_members")
      .upsert(
        {
          org_id: orgId,
          user_id: created.id,
          role: orgRole,
          status: "ACTIVE",
          invited_by: session.user_id,
          invited_at: nowIso,
          responded_at: nowIso,
        },
        { onConflict: "org_id,user_id" },
      )
      .select("org_id, user_id, role, status")
      .single();

    if (memErr || !mem) {
      return respond({ success: false, message: memErr?.message || "User created but membership failed" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: null,
      actor_user_id: session.user_id,
      action: "ORG_MEMBER_ADDED",
      metadata: { user_id: created.id, org_role: orgRole, billed_task: "ADD_MEMBER" },
    });

    return respond({ success: true, user: created, membership: mem }, corsHeaders, 200);
  } catch (err: any) {
    console.error("staff-create-org-member crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

