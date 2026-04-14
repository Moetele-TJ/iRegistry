import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { canOrgRestoreLegacy, getActiveOrgMembership } from "../shared/orgAuth.ts";
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

    const { data: item, error: fetchErr } = await supabase
      .from("items")
      .select("id, name, deletedat, legacyat, owner_org_id")
      .eq("id", itemId)
      .eq("owner_org_id", orgId)
      .maybeSingle();

    if (fetchErr || !item) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    if (item.deletedat) return respond({ success: false, message: "Cannot restore a deleted item" }, corsHeaders, 409);
    if (!item.legacyat) return respond({ success: false, message: "Item is not legacy" }, corsHeaders, 409);

    const { error: upErr } = await supabase
      .from("items")
      .update({
        legacyat: null,
        legacy_reason: null,
        legacy_by: null,
      })
      .eq("id", itemId)
      .eq("owner_org_id", orgId)
      .is("deletedat", null)
      .not("legacyat", "is", null);

    if (upErr) {
      return respond({ success: false, message: upErr.message || "Failed to restore item" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: "ORG_ITEM_LEGACY_RESTORED",
      metadata: { item_name: item.name || null },
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("org-restore-legacy-item crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

