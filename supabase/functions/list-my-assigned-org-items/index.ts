import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

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

    const { data, error } = await supabase
      .from("items")
      .select(
        `
          id,
          name,
          category,
          make,
          model,
          slug,
          photos,
          lastseen,
          reportedstolenat,
          deletedat,
          legacyat,
          createdon,
          updatedon,
          owner_org_id,
          assigned_user_id,
          org_assigned_at,
          org_assigned_by,
          orgs:owner_org_id (
            id,
            name
          )
        `,
      )
      .eq("assigned_user_id", session.user_id)
      .not("owner_org_id", "is", null)
      .is("deletedat", null)
      .order("updatedon", { ascending: false })
      .limit(200);

    if (error) {
      console.error("list-my-assigned-org-items:", error.message);
      return respond({ success: false, message: "Failed to load assigned items" }, corsHeaders, 500);
    }

    const rows = (data || []).map((r: any) => ({
      ...r,
      organization: r.orgs ?? null,
      orgs: undefined,
    }));

    return respond({ success: true, items: rows }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-my-assigned-org-items crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

