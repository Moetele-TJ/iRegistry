import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, isOrgPrivileged } from "../shared/orgAuth.ts";

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
    const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "OPEN";
    const scope = typeof body?.scope === "string" ? body.scope.trim().toLowerCase() : "mine"; // mine | org
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!["OPEN", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return respond({ success: false, message: "Invalid status" }, corsHeaders, 400);
    }
    if (!["mine", "org"].includes(scope)) {
      return respond({ success: false, message: "Invalid scope" }, corsHeaders, 400);
    }

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const privileged = isOrgPrivileged(membership.role);
    if (scope === "org" && !privileged) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    let q = supabase
      .from("org_item_return_requests")
      .select(
        `
          id,
          org_id,
          item_id,
          requester_user_id,
          status,
          requester_note,
          reviewer_user_id,
          reviewer_note,
          created_at,
          reviewed_at,
          items:item_id ( id, name, slug, assigned_user_id )
        `,
      )
      .eq("org_id", orgId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (scope === "mine") {
      q = q.eq("requester_user_id", session.user_id);
    }

    const { data, error } = await q;
    if (error) {
      return respond({ success: false, message: error.message || "Failed to load return requests" }, corsHeaders, 500);
    }

    const rows = (data || []).map((r: any) => ({
      ...r,
      item: r.items ?? null,
      items: undefined,
    }));

    return respond({ success: true, requests: rows, role: membership.role }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-org-item-return-requests crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

