import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership, isOrgPrivileged } from "../shared/orgAuth.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

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

    const staff = isPrivilegedRole(session.role);
    const membership = staff
      ? null
      : await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!staff && !membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    if (!staff && !isOrgPrivileged(membership?.role)) {
      return respond(
        {
          success: false,
          message: "Only organization managers and administrators can view payment history",
        },
        corsHeaders,
        403,
      );
    }

    const limit = Math.min(Math.max(Number(body?.limit) || 25, 1), 200);
    const offset = Math.max(Number(body?.offset) || 0, 0);

    const { data, error, count } = await supabase
      .from("org_payments")
      .select(
        "id, org_id, channel, status, currency, amount, credits_granted, provider, provider_reference, cashier_user_id, receipt_no, metadata, created_at, confirmed_at, reversed_at, reversed_by, reversed_reason",
        { count: "exact" },
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("list-org-payments:", error.message);
      return respond({ success: false, message: "Failed to load payments" }, corsHeaders, 500);
    }

    return respond(
      {
        success: true,
        payments: data || [],
        total: count ?? null,
        role: membership?.role ?? (staff ? "STAFF" : null),
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("list-org-payments crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
