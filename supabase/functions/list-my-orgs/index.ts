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
      .from("org_members")
      .select(
        `
          status,
          role,
          invited_at,
          responded_at,
          orgs:org_id (
            id,
            slug,
            name,
            registration_no,
            contact_email,
            phone,
            village,
            ward,
            updated_at
          )
        `,
      )
      .eq("user_id", session.user_id)
      .order("invited_at", { ascending: false });

    if (error) {
      return respond({ success: false, message: error.message || "Failed to load orgs" }, corsHeaders, 500);
    }

    const rows = (data || []).map((r: any) => ({
      status: r.status,
      role: r.role,
      invited_at: r.invited_at,
      responded_at: r.responded_at,
      org: r.orgs,
    }));

    return respond({ success: true, memberships: rows }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-my-orgs crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

