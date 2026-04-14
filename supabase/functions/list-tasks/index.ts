import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
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
    // Public read: `task_catalog` is pricing metadata only. The client loads it on the home page
    // (useTaskPricing / VerificationPanel) before sign-in — a session must not be required.
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

