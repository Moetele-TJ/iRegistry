import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, canOrgRestoreLegacy } from "../shared/orgAuth.ts";
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

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!itemId) return respond({ success: false, message: "item_id is required" }, corsHeaders, 400);

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership || !canOrgRestoreLegacy(membership.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const { data: existing, error: fetchError } = await supabase
      .from("items")
      .select("id, name, owner_org_id, deletedat")
      .eq("id", itemId)
      .eq("owner_org_id", orgId)
      .maybeSingle();

    if (fetchError || !existing) {
      return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    }
    if (!existing.deletedat) {
      return respond({ success: false, message: "This item is not deleted" }, corsHeaders, 409);
    }

    const { error: rpcErr } = await supabase.rpc("restore_soft_deleted_org_item", {
      p_org_id: orgId,
      p_item_id: itemId,
      p_skip_spend: false,
      p_created_by: session.user_id,
    });

    if (rpcErr) {
      const em = String(rpcErr.message || "");
      if (em.includes("INSUFFICIENT_CREDITS")) {
        return respond(
          { success: false, message: "Insufficient credits", billing: { required: true, task_code: "RESTORE_ITEM" } },
          corsHeaders,
          402,
        );
      }
      if (em.includes("RESTORE_FAILED")) {
        return respond({ success: false, message: "Failed to restore item right now, try again" }, corsHeaders, 409);
      }
      return respond({ success: false, message: rpcErr.message || "Failed to restore item" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: "ORG_ITEM_RESTORED",
      message: existing.name ? `${existing.name} was restored` : null,
      metadata: { restored_at: new Date().toISOString() },
    });

    return respond({ success: true, restored: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("org-restore-item crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

