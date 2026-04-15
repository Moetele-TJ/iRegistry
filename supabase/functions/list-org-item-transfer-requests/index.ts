import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const status = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "OPEN";
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
    const offset = Math.max(Number(body?.offset) || 0, 0);

    const allowed = new Set(["OPEN", "COMPLETED", "REJECTED", "CANCELLED"]);
    if (!allowed.has(status)) {
      return respond({ success: false, message: "Invalid status" }, corsHeaders, 400);
    }

    const { data, error, count } = await supabase
      .from("org_item_transfer_requests")
      .select(
        `
        id, org_id, item_id, target_user_id, reason, evidence, status, requested_by, requested_at,
        reviewed_by, reviewed_at, review_note, completed_at,
        orgs:org_id ( id, name ),
        items:item_id ( id, name ),
        users:target_user_id ( id, first_name, last_name, email, id_number ),
        requested_by_user:requested_by ( id, first_name, last_name, email, id_number )
      `,
        { count: "exact" },
      )
      .eq("status", status)
      .order("requested_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("list-org-item-transfer-requests:", error.message);
      return respond({ success: false, message: "Failed to load transfer requests" }, corsHeaders, 500);
    }

    const requests = (data || []).map((r: any) => ({
      ...r,
      organization: r.orgs ?? null,
      item: r.items ?? null,
      target_user: r.users ?? null,
      requested_by_user: r.requested_by_user ?? null,
      orgs: undefined,
      items: undefined,
      users: undefined,
      requested_by: undefined,
    }));

    return respond({ success: true, requests, total: count ?? null }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-org-item-transfer-requests crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

