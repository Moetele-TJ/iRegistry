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
    // Auth required (pricing should be visible inside dashboards)
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    const { data, error } = await supabase
      .from("task_catalog")
      .select("code, name, description, credits_cost, active, updated_at")
      .order("credits_cost", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return respond({ success: false, message: error.message || "Failed to load tasks" }, corsHeaders, 500);
    }

    return respond({ success: true, tasks: data || [] }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-tasks crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

