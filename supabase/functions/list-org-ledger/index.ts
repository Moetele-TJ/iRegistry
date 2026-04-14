import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, isOrgPrivileged } from "../shared/orgAuth.ts";

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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    if (!isOrgPrivileged(membership.role)) {
      return respond(
        { success: false, message: "Only organization managers and administrators can view the full ledger" },
        corsHeaders,
        403,
      );
    }

    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
    const offset = Math.max(Number(body?.offset) || 0, 0);

    const { data, error, count } = await supabase
      .from("org_credit_ledger")
      .select(
        "id, org_id, entry_type, amount, task_code, reference, metadata, created_by, created_at",
        { count: "exact" },
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("list-org-ledger:", error.message);
      return respond({ success: false, message: "Failed to load ledger" }, corsHeaders, 500);
    }

    return respond(
      {
        success: true,
        entries: data || [],
        total: count ?? null,
        role: membership.role,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("list-org-ledger crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
