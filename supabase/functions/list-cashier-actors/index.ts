import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { roleIs } from "../shared/roles.ts";

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
    if (!roleIs(session.role, "admin")) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    // Pull recent cashier payments and dedupe actor IDs in code.
    // This avoids relying on current role in users table.
    const { data, error } = await supabase
      .from("payments")
      .select("cashier_user_id, users!payments_cashier_user_id_fkey(id, first_name, last_name, email, id_number, phone)")
      .eq("channel", "CASHIER")
      .not("cashier_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) return respond({ success: false, message: error.message || "Failed to list cashiers" }, corsHeaders, 500);

    const seen = new Set<string>();
    const actors: any[] = [];
    for (const row of data || []) {
      const id = String((row as any).cashier_user_id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      actors.push((row as any).users || { id });
    }

    return respond({ success: true, cashiers: actors }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-cashier-actors crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

