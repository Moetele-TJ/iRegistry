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

    const orgId = typeof body?.org_id === "string" ? body.org_id : "";
    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const privileged = isOrgPrivileged(membership.role);

    const includeDeleted = !!body?.includeDeleted;
    const includeLegacy = !!body?.includeLegacy;
    const onlyUnassigned = !!body?.onlyUnassigned;
    const q = typeof body?.q === "string" ? body.q.trim() : "";
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

    let query = supabase
      .from("items")
      .select(
        "id, name, category, make, model, slug, ownerid, owner_org_id, assigned_user_id, org_assigned_at, reportedstolenat, deletedat, legacyat, createdon, updatedon",
        { count: "exact" },
      )
      .eq("owner_org_id", orgId)
      .order("updatedon", { ascending: false })
      .limit(limit);

    if (!includeDeleted) query = query.is("deletedat", null);
    if (!includeLegacy) query = query.is("legacyat", null);

    if (!privileged) {
      // Members may only see items assigned to them.
      query = query.eq("assigned_user_id", session.user_id);
    } else if (onlyUnassigned) {
      query = query.is("assigned_user_id", null);
    }

    if (q) {
      // Basic search across commonly used fields.
      const esc = q.replace(/[%_]/g, "\\$&");
      query = query.or(
        `name.ilike.%${esc}%,category.ilike.%${esc}%,make.ilike.%${esc}%,model.ilike.%${esc}%,slug.ilike.%${esc}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("list-org-items:", error.message);
      return respond({ success: false, message: "Failed to load items" }, corsHeaders, 500);
    }

    return respond(
      {
        success: true,
        items: data || [],
        total: count ?? null,
        role: membership.role,
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("list-org-items crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

