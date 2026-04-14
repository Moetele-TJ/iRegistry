import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, isOrgPrivileged } from "../shared/orgAuth.ts";
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
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 800) : null;

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!itemId) return respond({ success: false, message: "item_id is required" }, corsHeaders, 400);

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const privileged = isOrgPrivileged(membership.role);

    const { data: item, error: iErr } = await supabase
      .from("items")
      .select("id, owner_org_id, assigned_user_id, name, deletedat, legacyat")
      .eq("id", itemId)
      .maybeSingle();

    if (iErr || !item) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    if (String(item.owner_org_id || "") !== String(orgId)) {
      return respond({ success: false, message: "Item does not belong to this organization" }, corsHeaders, 403);
    }
    if (item.deletedat) return respond({ success: false, message: "Item is deleted" }, corsHeaders, 409);
    if (item.legacyat) return respond({ success: false, message: "Item is legacy" }, corsHeaders, 409);

    if (!privileged) {
      // Members may only request return for items assigned to them.
      if (String(item.assigned_user_id || "") !== String(session.user_id)) {
        return respond({ success: false, message: "Only the assignee can request return" }, corsHeaders, 403);
      }
    }

    const { data: created, error: cErr } = await supabase
      .from("org_item_return_requests")
      .insert({
        org_id: orgId,
        item_id: itemId,
        requester_user_id: session.user_id,
        status: "OPEN",
        requester_note: note,
      })
      .select("id, org_id, item_id, requester_user_id, status, requester_note, created_at")
      .single();

    if (cErr || !created) {
      const msg = String(cErr?.message || "");
      if (msg.includes("org_item_return_requests_one_open_per_item_idx")) {
        return respond({ success: false, message: "A return request is already open for this item" }, corsHeaders, 409);
      }
      return respond({ success: false, message: cErr?.message || "Failed to create return request" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: "ORG_ITEM_RETURN_REQUESTED",
      metadata: { request_id: created.id, note: note || null, item_name: item.name || null },
    });

    return respond({ success: true, request: created }, corsHeaders, 200);
  } catch (err: any) {
    console.error("create-org-item-return-request crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

