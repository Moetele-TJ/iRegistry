import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isAppAdmin } from "../shared/orgAuth.ts";
import { logAudit } from "../shared/logAudit.ts";
import { logOrgItemActivity } from "../shared/logOrgItemActivity.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type TransferMode = "personal_to_org" | "org_to_personal";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!isAppAdmin(session.role)) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const mode = typeof body?.mode === "string" ? body.mode.trim() as TransferMode : null;
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const targetOrgId = typeof body?.target_org_id === "string" ? body.target_org_id : "";
    const targetUserId = typeof body?.target_user_id === "string" ? body.target_user_id : "";
    const assignToUserId = typeof body?.assign_to_user_id === "string" ? body.assign_to_user_id : "";

    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 800) : "";
    const evidence = body?.evidence ?? null; // flexible (url(s), ids, notes)

    if (!mode || !["personal_to_org", "org_to_personal"].includes(mode)) {
      return respond({ success: false, message: "mode must be personal_to_org|org_to_personal" }, corsHeaders, 400);
    }
    if (!itemId) return respond({ success: false, message: "item_id is required" }, corsHeaders, 400);
    if (!reason) return respond({ success: false, message: "reason is required" }, corsHeaders, 400);

    const { data: item, error: iErr } = await supabase
      .from("items")
      .select("id, name, ownerid, owner_org_id, assigned_user_id, deletedat, legacyat")
      .eq("id", itemId)
      .maybeSingle();

    if (iErr || !item) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    if (item.deletedat) return respond({ success: false, message: "Cannot transfer a deleted item" }, corsHeaders, 409);
    if (item.legacyat) return respond({ success: false, message: "Cannot transfer a legacy item" }, corsHeaders, 409);

    if (mode === "personal_to_org") {
      if (!targetOrgId) return respond({ success: false, message: "target_org_id is required" }, corsHeaders, 400);

      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = {
        owner_org_id: targetOrgId,
        assigned_user_id: assignToUserId || null,
        org_assigned_at: assignToUserId ? nowIso : null,
        org_assigned_by: session.user_id,
      };

      const { error: upErr } = await supabase
        .from("items")
        .update(patch)
        .eq("id", itemId)
        .is("deletedat", null)
        .is("legacyat", null);

      if (upErr) {
        return respond({ success: false, message: upErr.message || "Transfer failed" }, corsHeaders, 500);
      }

      await logAudit({
        supabase,
        event: "APP_ADMIN_TRANSFER_PERSONAL_TO_ORG",
        user_id: String(session.user_id),
        channel: "ADMIN",
        actor_user_id: session.user_id,
        target_user_id: item.ownerid ?? null,
        success: true,
        severity: "high",
        diag: "XFER-P2O",
        metadata: {
          item_id: itemId,
          item_name: item.name ?? null,
          from_owner_user_id: item.ownerid ?? null,
          to_org_id: targetOrgId,
          assign_to_user_id: assignToUserId || null,
          reason,
          evidence,
        },
        req,
      });

      await logOrgItemActivity(supabase, {
        org_id: targetOrgId,
        item_id: itemId,
        actor_user_id: session.user_id,
        action: "APP_ADMIN_TRANSFER_INTO_ORG",
        metadata: {
          from_owner_user_id: item.ownerid ?? null,
          assign_to_user_id: assignToUserId || null,
          reason,
          evidence,
        },
      });

      return respond({ success: true }, corsHeaders, 200);
    }

    // org_to_personal
    if (!item.owner_org_id) {
      return respond({ success: false, message: "Item is not organization-owned" }, corsHeaders, 409);
    }
    if (!targetUserId) return respond({ success: false, message: "target_user_id is required" }, corsHeaders, 400);

    const fromOrgId = String(item.owner_org_id);
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
      .eq("owner_org_id", fromOrgId)
      .is("deletedat", null)
      .is("legacyat", null);

    if (upErr) {
      return respond({ success: false, message: upErr.message || "Transfer failed" }, corsHeaders, 500);
    }

    await logAudit({
      supabase,
      event: "APP_ADMIN_TRANSFER_ORG_TO_PERSONAL",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      target_user_id: targetUserId,
      success: true,
      severity: "high",
      diag: "XFER-O2P",
      metadata: {
        item_id: itemId,
        item_name: item.name ?? null,
        from_org_id: fromOrgId,
        to_owner_user_id: targetUserId,
        reason,
        evidence,
      },
      req,
    });

    await logOrgItemActivity(supabase, {
      org_id: fromOrgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: "APP_ADMIN_TRANSFER_OUT_OF_ORG",
      metadata: {
        to_owner_user_id: targetUserId,
        reason,
        evidence,
      },
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("app-admin-transfer-item-scope crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

