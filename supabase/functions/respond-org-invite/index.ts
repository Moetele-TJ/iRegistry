import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
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
    const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "";

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!["accept", "reject"].includes(action)) {
      return respond({ success: false, message: "action must be accept|reject" }, corsHeaders, 400);
    }

    const { data: membership, error: mErr } = await supabase
      .from("org_members")
      .select("id, status, role, org_id")
      .eq("org_id", orgId)
      .eq("user_id", session.user_id)
      .maybeSingle();

    if (mErr) return respond({ success: false, message: "Failed to load invite" }, corsHeaders, 500);
    if (!membership) return respond({ success: false, message: "Invite not found" }, corsHeaders, 404);
    if (membership.status !== "INVITED") {
      return respond({ success: false, message: "Invite already responded to" }, corsHeaders, 409);
    }

    const next = action === "accept" ? "ACTIVE" : "REJECTED";

    const { data: upd, error: uErr } = await supabase
      .from("org_members")
      .update({ status: next, responded_at: new Date().toISOString() })
      .eq("id", membership.id)
      .eq("status", "INVITED")
      .select("org_id, status, role, responded_at")
      .single();

    if (uErr || !upd) {
      return respond({ success: false, message: "Failed to update invite" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: null,
      actor_user_id: session.user_id,
      action: action === "accept" ? "ORG_INVITE_ACCEPTED" : "ORG_INVITE_REJECTED",
      message: null,
      metadata: { membership_role: upd.role },
    });

    return respond({ success: true, membership: upd }, corsHeaders, 200);
  } catch (err: any) {
    console.error("respond-org-invite crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

