import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getActiveOrgMembership, orgRoleIs } from "../shared/orgAuth.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
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
    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);

    const staff = isPrivilegedRole(session.role);
    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });

    const canEdit =
      staff || (membership != null && orgRoleIs(membership.role, "ORG_ADMIN"));

    if (!canEdit) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const { data: existingOrg, error: fetchErr } = await supabase
      .from("orgs")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();

    if (fetchErr || !existingOrg) {
      return respond({ success: false, message: "Organization not found" }, corsHeaders, 404);
    }

    const patch: Record<string, unknown> = {};

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return respond({ success: false, message: "Organization name cannot be empty" }, corsHeaders, 400);
      patch.name = name.slice(0, 200);
    }

    const opt = (key: string, max: number) => {
      if (!(key in body)) return;
      const v = (body as Record<string, unknown>)[key];
      if (v === null || v === undefined) {
        patch[key] = null;
        return;
      }
      if (typeof v !== "string") return;
      const s = v.trim();
      patch[key] = s ? s.slice(0, max) : null;
    };

    opt("registration_no", 120);
    opt("contact_email", 200);
    opt("phone", 50);
    opt("village", 120);
    opt("ward", 120);

    if (Object.keys(patch).length === 0) {
      return respond({ success: false, message: "No fields to update" }, corsHeaders, 400);
    }

    if (typeof patch.contact_email === "string" && patch.contact_email) {
      patch.contact_email = String(patch.contact_email).toLowerCase().slice(0, 200);
    }

    const effectiveName =
      typeof patch.name === "string" && String(patch.name).trim()
        ? String(patch.name).trim()
        : String(existingOrg.name || "").trim();

    if (!effectiveName) {
      return respond({ success: false, message: "Organization name cannot be empty" }, corsHeaders, 400);
    }

    patch.slug = orgSlugFromNameAndId(effectiveName, orgId);

    const { data: org, error } = await supabase
      .from("orgs")
      .update(patch)
      .eq("id", orgId)
      .select("id, name, registration_no, contact_email, phone, village, ward, updated_at")
      .single();

    if (error || !org) {
      console.error("update-organization:", error?.message);
      return respond(
        { success: false, message: error?.message || "Failed to update organization" },
        corsHeaders,
        500,
      );
    }

    const channel = staff ? "STAFF" : "ORG";
    await logAudit({
      supabase,
      event: "ORG_UPDATED",
      user_id: String(session.user_id),
      channel,
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "ORG-UPDATE",
      metadata: { org_id: orgId, fields: Object.keys(patch) },
      req,
    });

    return respond({ success: true, org }, corsHeaders, 200);
  } catch (err: unknown) {
    console.error("update-organization crash:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
