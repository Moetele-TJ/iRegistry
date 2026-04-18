import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";
import { logAudit } from "../shared/logAudit.ts";

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
    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);

    const { data: orgRow, error: orgErr } = await supabase
      .from("orgs")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr || !orgRow) {
      return respond({ success: false, message: "Organization not found" }, corsHeaders, 404);
    }

    const { count, error: cntErr } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("owner_org_id", orgId);

    if (cntErr) {
      console.error("delete-organization count:", cntErr.message);
      return respond({ success: false, message: cntErr.message || "Failed to verify items" }, corsHeaders, 500);
    }

    if ((count ?? 0) > 0) {
      return respond(
        {
          success: false,
          message:
            "This organization still owns registry items. Reassign, delete, or move those items before deleting the organization.",
        },
        corsHeaders,
        409,
      );
    }

    const { error: delErr } = await supabase.from("orgs").delete().eq("id", orgId);

    if (delErr) {
      console.error("delete-organization:", delErr.message);
      return respond(
        { success: false, message: delErr.message || "Failed to delete organization" },
        corsHeaders,
        500,
      );
    }

    const channel = roleIs(session.role, "cashier") ? "CASHIER" : "ADMIN";
    await logAudit({
      supabase,
      event: "ORG_DELETED",
      user_id: String(session.user_id),
      channel,
      actor_user_id: session.user_id,
      success: true,
      severity: "high",
      diag: "ORG-DELETE",
      metadata: { org_id: orgId, name: orgRow.name },
      req,
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: unknown) {
    console.error("delete-organization crash:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
