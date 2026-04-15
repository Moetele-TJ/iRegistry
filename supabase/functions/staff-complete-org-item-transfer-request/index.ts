import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";
import { logAudit } from "../shared/logAudit.ts";
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
    const requestId = typeof body?.request_id === "string" ? body.request_id : "";
    const action = typeof body?.action === "string" ? body.action.trim().toUpperCase() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 800) : "";

    if (!requestId) return respond({ success: false, message: "request_id is required" }, corsHeaders, 400);
    if (!["COMPLETE", "REJECT"].includes(action)) {
      return respond({ success: false, message: "action must be COMPLETE|REJECT" }, corsHeaders, 400);
    }

    const { data: reqRow, error: rErr } = await supabase
      .from("org_item_transfer_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (rErr || !reqRow) return respond({ success: false, message: "Request not found" }, corsHeaders, 404);
    if (reqRow.status !== "OPEN") return respond({ success: false, message: "Request is not open" }, corsHeaders, 409);

    const orgId = String(reqRow.org_id);
    const itemId = String(reqRow.item_id);
    const targetUserId = String(reqRow.target_user_id);

    if (action === "REJECT") {
      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("org_item_transfer_requests")
        .update({
          status: "REJECTED",
          reviewed_by: session.user_id,
          reviewed_at: nowIso,
          review_note: note || null,
        })
        .eq("id", requestId)
        .eq("status", "OPEN");

      if (upErr) return respond({ success: false, message: upErr.message || "Failed to reject" }, corsHeaders, 500);

      await logAudit({
        supabase,
        event: "STAFF_REJECT_ORG_ITEM_TRANSFER",
        user_id: String(session.user_id),
        channel: roleIs(session.role, "cashier") ? "CASHIER" : "ADMIN",
        actor_user_id: session.user_id,
        target_user_id: targetUserId,
        success: true,
        severity: "high",
        diag: "ORG-XFER-REJECT",
        metadata: {
          request_id: requestId,
          org_id: orgId,
          item_id: itemId,
          note: note || null,
        },
        req,
      });

      await logOrgItemActivity(supabase, {
        org_id: orgId,
        item_id: itemId,
        actor_user_id: session.user_id,
        action: "STAFF_REJECT_ORG_ITEM_TRANSFER",
        metadata: { request_id: requestId, note: note || null },
      });

      return respond({ success: true }, corsHeaders, 200);
    }

    // COMPLETE: transfer org-owned item -> personal owner
    const { data: item, error: iErr } = await supabase
      .from("items")
      .select("id, name, ownerid, owner_org_id, assigned_user_id, deletedat, legacyat")
      .eq("id", itemId)
      .maybeSingle();

    if (iErr || !item) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    if (String(item.owner_org_id || "") !== orgId) {
      return respond({ success: false, message: "Item is not currently owned by this organization" }, corsHeaders, 409);
    }
    if (item.deletedat) return respond({ success: false, message: "Cannot transfer a deleted item" }, corsHeaders, 409);
    if (item.legacyat) return respond({ success: false, message: "Cannot transfer a legacy item" }, corsHeaders, 409);

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      owner_org_id: null,
      assigned_user_id: null,
      org_assigned_at: null,
      org_assigned_by: session.user_id,
      ownerid: targetUserId,
    };

    const { error: upErr } = await supabase
      .from("items")
      .update(patch)
      .eq("id", itemId)
      .eq("owner_org_id", orgId)
      .is("deletedat", null)
      .is("legacyat", null);

    if (upErr) return respond({ success: false, message: upErr.message || "Transfer failed" }, corsHeaders, 500);

    const { error: reqUpErr } = await supabase
      .from("org_item_transfer_requests")
      .update({
        status: "COMPLETED",
        reviewed_by: session.user_id,
        reviewed_at: nowIso,
        review_note: note || null,
        completed_at: nowIso,
      })
      .eq("id", requestId)
      .eq("status", "OPEN");

    if (reqUpErr) return respond({ success: false, message: reqUpErr.message || "Transfer completed, but request update failed" }, corsHeaders, 500);

    await logAudit({
      supabase,
      event: "STAFF_COMPLETE_ORG_ITEM_TRANSFER",
      user_id: String(session.user_id),
      channel: roleIs(session.role, "cashier") ? "CASHIER" : "ADMIN",
      actor_user_id: session.user_id,
      target_user_id: targetUserId,
      success: true,
      severity: "high",
      diag: "ORG-XFER-COMPLETE",
      metadata: {
        request_id: requestId,
        org_id: orgId,
        item_id: itemId,
        item_name: item.name ?? null,
        from_org_id: orgId,
        to_owner_user_id: targetUserId,
        reason: reqRow.reason ?? null,
        evidence: reqRow.evidence ?? null,
        note: note || null,
      },
      req,
    });

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: "STAFF_COMPLETE_ORG_ITEM_TRANSFER",
      metadata: {
        request_id: requestId,
        to_owner_user_id: targetUserId,
        reason: reqRow.reason ?? null,
        evidence: reqRow.evidence ?? null,
        note: note || null,
      },
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("staff-complete-org-item-transfer-request crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

