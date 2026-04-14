import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import {
  canOrgAssign,
  getActiveOrgMembership,
} from "../shared/orgAuth.ts";
import { logOrgItemActivity } from "../shared/logOrgItemActivity.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function uniqStrings(xs: unknown): string[] {
  if (!Array.isArray(xs)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = typeof x === "string" ? x.trim() : "";
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

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
    const itemIds = uniqStrings(body?.item_ids);
    const assignTo = typeof body?.assign_to_user_id === "string"
      ? body.assign_to_user_id.trim()
      : null; // null means unassign

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (itemIds.length === 0) return respond({ success: false, message: "item_ids is required" }, corsHeaders, 400);
    if (itemIds.length > 200) return respond({ success: false, message: "Too many items (max 200)" }, corsHeaders, 400);

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership || !canOrgAssign(membership.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    if (assignTo) {
      const { data: target, error: tErr } = await supabase
        .from("org_members")
        .select("status")
        .eq("org_id", orgId)
        .eq("user_id", assignTo)
        .maybeSingle();
      if (tErr) return respond({ success: false, message: "Failed to validate assignee" }, corsHeaders, 500);
      if (!target || target.status !== "ACTIVE") {
        return respond({ success: false, message: "Assignee is not an active member" }, corsHeaders, 400);
      }
    }

    // Ensure all items belong to org
    const { data: items, error: iErr } = await supabase
      .from("items")
      .select("id, assigned_user_id")
      .in("id", itemIds)
      .eq("owner_org_id", orgId)
      .is("deletedat", null);

    if (iErr) return respond({ success: false, message: "Failed to load items" }, corsHeaders, 500);

    const foundIds = new Set((items || []).map((r: any) => String(r.id)));
    const missing = itemIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      return respond(
        { success: false, message: "Some items not found in org", missing },
        corsHeaders,
        404,
      );
    }

    const nowIso = new Date().toISOString();
    const patch = assignTo
      ? { assigned_user_id: assignTo, org_assigned_at: nowIso, org_assigned_by: session.user_id }
      : { assigned_user_id: null, org_assigned_at: null, org_assigned_by: session.user_id };

    const { error: upErr } = await supabase
      .from("items")
      .update(patch)
      .in("id", itemIds)
      .eq("owner_org_id", orgId);

    if (upErr) {
      return respond({ success: false, message: upErr.message || "Failed to update assignments" }, corsHeaders, 500);
    }

    // Bulk log + per item log (per spec; can revise if volume becomes large)
    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: null,
      actor_user_id: session.user_id,
      action: assignTo ? "ORG_ITEMS_BULK_ASSIGNED" : "ORG_ITEMS_BULK_UNASSIGNED",
      metadata: { count: itemIds.length, assign_to_user_id: assignTo, item_ids: itemIds },
    });

    for (const id of itemIds) {
      await logOrgItemActivity(supabase, {
        org_id: orgId,
        item_id: id,
        actor_user_id: session.user_id,
        action: assignTo ? "ORG_ITEM_ASSIGNED" : "ORG_ITEM_UNASSIGNED",
        metadata: { assign_to_user_id: assignTo },
      });
    }

    return respond(
      {
        success: true,
        updated: itemIds.length,
        assigned_to_user_id: assignTo,
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("bulk-assign-org-items crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

