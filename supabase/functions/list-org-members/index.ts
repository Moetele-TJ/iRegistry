import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, isOrgPrivileged, orgRoleIs } from "../shared/orgAuth.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const orgId = typeof body?.org_id === "string" ? body.org_id : "";
    const includeInvited = !!body?.includeInvited;

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);

    const staff = isPrivilegedRole(session.role);
    const membership = staff
      ? null
      : await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!staff && (!membership || !isOrgPrivileged(membership.role))) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }
    const actorRole = membership?.role ?? "ORG_ADMIN";
    const canInvite = staff || orgRoleIs(actorRole, "ORG_ADMIN");

    let q = supabase
      .from("org_members")
      .select(
        `
          user_id,
          role,
          status,
          invited_at,
          responded_at,
          users:user_id (
            id,
            first_name,
            last_name,
            email,
            phone,
            id_number,
            date_of_birth,
            village,
            ward,
            role,
            status
          )
        `,
      )
      .eq("org_id", orgId)
      .order("invited_at", { ascending: false });

    if (!includeInvited) {
      q = q.eq("status", "ACTIVE");
    } else {
      q = q.neq("status", "REMOVED");
    }

    const { data, error } = await q;
    if (error) {
      return respond({ success: false, message: error.message || "Failed to load members" }, corsHeaders, 500);
    }

    const members = (data || []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role,
      status: r.status,
      invited_at: r.invited_at,
      responded_at: r.responded_at,
      user: r.users,
    }));

    return respond({ success: true, members, actor_role: actorRole, can_invite: canInvite }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-org-members crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

