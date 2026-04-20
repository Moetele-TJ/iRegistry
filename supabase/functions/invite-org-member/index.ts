import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, orgRoleIs } from "../shared/orgAuth.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { logOrgItemActivity } from "../shared/logOrgItemActivity.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id : "";
    const userId = typeof body?.user_id === "string" ? body.user_id : "";
    const role = typeof body?.role === "string" ? body.role.trim().toUpperCase() : "ORG_MEMBER";

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!userId) return respond({ success: false, message: "user_id is required" }, corsHeaders, 400);
    if (!orgRoleIs(role, "ORG_ADMIN", "ORG_MANAGER", "ORG_MEMBER")) {
      return respond({ success: false, message: "Invalid role" }, corsHeaders, 400);
    }

    const staff = isPrivilegedRole(session.role);
    const actorMembership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!staff && (!actorMembership || !orgRoleIs(actorMembership.role, "ORG_ADMIN"))) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    // Upsert membership as INVITED (or re-invite if previously rejected/removed).
    const nowIso = new Date().toISOString();
    const { data: existing, error: exErr } = await supabase
      .from("org_members")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (exErr) {
      return respond({ success: false, message: "Failed to check membership" }, corsHeaders, 500);
    }
    if (existing?.status === "ACTIVE") {
      return respond({ success: false, message: "User is already an active member" }, corsHeaders, 409);
    }

    const payload: Record<string, unknown> = {
      org_id: orgId,
      user_id: userId,
      role,
      status: "INVITED",
      invited_by: session.user_id,
      invited_at: nowIso,
      responded_at: null,
    };

    const { data: up, error: upErr } = await supabase
      .from("org_members")
      .upsert(payload, { onConflict: "org_id,user_id" })
      .select("org_id, user_id, role, status, invited_at")
      .single();

    if (upErr || !up) {
      return respond({ success: false, message: upErr?.message || "Failed to invite member" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: null,
      actor_user_id: session.user_id,
      action: "ORG_MEMBER_INVITED",
      metadata: { invited_user_id: userId, role },
    });

    return respond({ success: true, membership: up }, corsHeaders, 200);
  } catch (err: any) {
    console.error("invite-org-member crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

