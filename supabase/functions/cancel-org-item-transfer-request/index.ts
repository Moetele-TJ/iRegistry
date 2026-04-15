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
    const requestId = typeof body?.request_id === "string" ? body.request_id : "";

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!requestId) return respond({ success: false, message: "request_id is required" }, corsHeaders, 400);

    const m = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!m || !orgRoleIs(m.role, "ORG_ADMIN")) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const { data: reqRow, error: rErr } = await supabase
      .from("org_item_transfer_requests")
      .select("id, org_id, item_id, status")
      .eq("id", requestId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (rErr || !reqRow) return respond({ success: false, message: "Request not found" }, corsHeaders, 404);
    if (reqRow.status !== "OPEN") return respond({ success: false, message: "Only open requests can be cancelled" }, corsHeaders, 409);

    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("org_item_transfer_requests")
      .update({
        status: "CANCELLED",
        reviewed_by: session.user_id,
        reviewed_at: nowIso,
        review_note: "Cancelled by organization administrator",
      })
      .eq("id", requestId)
      .eq("org_id", orgId)
      .eq("status", "OPEN");

    if (upErr) return respond({ success: false, message: upErr.message || "Failed to cancel request" }, corsHeaders, 500);

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: reqRow.item_id,
      actor_user_id: session.user_id,
      action: "ORG_ITEM_TRANSFER_REQUEST_CANCELLED",
      metadata: { request_id: requestId },
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("cancel-org-item-transfer-request crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

