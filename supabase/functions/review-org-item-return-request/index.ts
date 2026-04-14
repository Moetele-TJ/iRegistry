import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import {
  canOrgAssign,
  getActiveOrgMembership,
  isOrgPrivileged,
} from "../shared/orgAuth.ts";
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
    const requestId = typeof body?.request_id === "string" ? body.request_id : "";
    const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 800) : null;

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!requestId) return respond({ success: false, message: "request_id is required" }, corsHeaders, 400);
    if (!["approve", "reject"].includes(action)) {
      return respond({ success: false, message: "action must be approve|reject" }, corsHeaders, 400);
    }

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership || !isOrgPrivileged(membership.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }
    if (!canOrgAssign(membership.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const { data: reqRow, error: rErr } = await supabase
      .from("org_item_return_requests")
      .select("id, org_id, item_id, requester_user_id, status")
      .eq("id", requestId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (rErr || !reqRow) return respond({ success: false, message: "Request not found" }, corsHeaders, 404);
    if (reqRow.status !== "OPEN") {
      return respond({ success: false, message: "Request is not open" }, corsHeaders, 409);
    }

    const nextStatus = action === "approve" ? "APPROVED" : "REJECTED";
    const nowIso = new Date().toISOString();

    const { data: updated, error: uErr } = await supabase
      .from("org_item_return_requests")
      .update({
        status: nextStatus,
        reviewer_user_id: session.user_id,
        reviewer_note: note,
        reviewed_at: nowIso,
      })
      .eq("id", requestId)
      .eq("org_id", orgId)
      .eq("status", "OPEN")
      .select("id, status, reviewed_at")
      .single();

    if (uErr || !updated) {
      return respond({ success: false, message: "Failed to update request" }, corsHeaders, 500);
    }

    if (action === "approve") {
      // Unassign item (return to org pool)
      const { error: itemErr } = await supabase
        .from("items")
        .update({
          assigned_user_id: null,
          org_assigned_at: null,
          org_assigned_by: session.user_id,
        })
        .eq("id", reqRow.item_id)
        .eq("owner_org_id", orgId);

      if (itemErr) {
        return respond({ success: false, message: itemErr.message || "Failed to unassign item" }, corsHeaders, 500);
      }
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: reqRow.item_id,
      actor_user_id: session.user_id,
      action: action === "approve" ? "ORG_ITEM_RETURN_APPROVED" : "ORG_ITEM_RETURN_REJECTED",
      metadata: { request_id: requestId, note: note || null, requester_user_id: reqRow.requester_user_id },
    });

    return respond({ success: true, request: updated }, corsHeaders, 200);
  } catch (err: any) {
    console.error("review-org-item-return-request crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

