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
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!userId) return respond({ success: false, message: "user_id is required" }, corsHeaders, 400);

    const staff = isPrivilegedRole(session.role);
    const actorMembership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!staff && (!actorMembership || !orgRoleIs(actorMembership.role, "ORG_ADMIN"))) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    if (userId === session.user_id) {
      return respond({ success: false, message: "You cannot remove yourself" }, corsHeaders, 409);
    }

    const nowIso = new Date().toISOString();
    const { data: up, error: upErr } = await supabase
      .from("org_members")
      .update({ status: "REMOVED", responded_at: nowIso })
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .neq("status", "REMOVED")
      .select("org_id, user_id, role, status, responded_at")
      .maybeSingle();

    if (upErr) {
      return respond({ success: false, message: upErr.message || "Failed to remove member" }, corsHeaders, 500);
    }
    if (!up) {
      return respond({ success: false, message: "Member not found or already removed" }, corsHeaders, 404);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: null,
      actor_user_id: session.user_id,
      action: "ORG_MEMBER_REMOVED",
      metadata: { user_id: userId, reason: reason || null },
    });

    return respond({ success: true, membership: up }, corsHeaders, 200);
  } catch (err: any) {
    console.error("org-remove-member crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

