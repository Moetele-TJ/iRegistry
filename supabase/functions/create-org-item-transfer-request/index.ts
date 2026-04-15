import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, orgRoleIs } from "../shared/orgAuth.ts";
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

    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id : "";
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const targetUserId = typeof body?.target_user_id === "string" ? body.target_user_id : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 800) : "";
    const evidence = body?.evidence ?? null;

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!itemId) return respond({ success: false, message: "item_id is required" }, corsHeaders, 400);
    if (!targetUserId) return respond({ success: false, message: "target_user_id is required" }, corsHeaders, 400);
    if (!reason) return respond({ success: false, message: "reason is required" }, corsHeaders, 400);

    const m = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!m || !orgRoleIs(m.role, "ORG_ADMIN")) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const { data: item, error: iErr } = await supabase
      .from("items")
      .select("id, owner_org_id, deletedat, legacyat")
      .eq("id", itemId)
      .maybeSingle();

    if (iErr || !item) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    if (String(item.owner_org_id || "") !== String(orgId)) {
      return respond({ success: false, message: "Item is not owned by this organization" }, corsHeaders, 409);
    }
    if (item.deletedat) return respond({ success: false, message: "Cannot transfer a deleted item" }, corsHeaders, 409);
    if (item.legacyat) return respond({ success: false, message: "Cannot transfer a legacy item" }, corsHeaders, 409);

    // Ensure target user exists
    const { data: tu } = await supabase.from("users").select("id").eq("id", targetUserId).maybeSingle();
    if (!tu) return respond({ success: false, message: "Target user not found" }, corsHeaders, 404);

    const { data: reqRow, error: rErr } = await supabase
      .from("org_item_transfer_requests")
      .insert({
        org_id: orgId,
        item_id: itemId,
        target_user_id: targetUserId,
        reason,
        evidence,
        status: "OPEN",
        requested_by: session.user_id,
      })
      .select("*")
      .single();

    if (rErr || !reqRow) {
      const em = String(rErr?.message || "");
      if (em.includes("org_item_transfer_requests_one_open_per_item_idx")) {
        return respond({ success: false, message: "There is already an open transfer request for this item" }, corsHeaders, 409);
      }
      return respond({ success: false, message: rErr?.message || "Failed to create request" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: "ORG_ITEM_TRANSFER_REQUESTED",
      metadata: { target_user_id: targetUserId, reason, evidence, request_id: reqRow.id },
    });

    return respond({ success: true, request: reqRow }, corsHeaders, 200);
  } catch (err: any) {
    console.error("create-org-item-transfer-request crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

