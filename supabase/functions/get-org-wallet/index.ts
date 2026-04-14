import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getActiveOrgMembership } from "../shared/orgAuth.ts";

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

    const { data: orgRow, error: orgErr } = await supabase
      .from("orgs")
      .select("id, name, registration_no")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr || !orgRow) {
      console.error("get-org-wallet org:", orgErr?.message);
      return respond({ success: false, message: "Organization not found" }, corsHeaders, 404);
    }

    const { data: creditRow } = await supabase
      .from("org_credits")
      .select("balance, updated_at")
      .eq("org_id", orgId)
      .maybeSingle();

    const balance = typeof creditRow?.balance === "number" ? creditRow.balance : 0;

    return respond(
      {
        success: true,
        organization: {
          id: orgRow.id,
          name: orgRow.name,
          registration_no: orgRow.registration_no ?? null,
        },
        balance,
        credits_updated_at: creditRow?.updated_at ?? null,
        role: membership.role,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("get-org-wallet crash:", err);
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});
