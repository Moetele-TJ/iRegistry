import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";

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

    // Cashier can top up org wallets; admin can manage orgs.
    if (!isPrivilegedRole(session.role) && !roleIs(session.role, "admin")) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const q = typeof body?.q === "string" ? body.q.trim() : "";
    const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);

    let query = supabase
      .from("orgs")
      .select("id, slug, name, registration_no, contact_email, phone, updated_at")
      .order("name", { ascending: true })
      .limit(limit);

    if (q) {
      const esc = q.replace(/[%_]/g, "\\$&");
      query = query.or(`name.ilike.%${esc}%,registration_no.ilike.%${esc}%`);
    }

    const { data, error } = await query;
    if (error) {
      return respond({ success: false, message: error.message || "Failed to load organizations" }, corsHeaders, 500);
    }

    return respond({ success: true, organizations: data || [] }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-orgs crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

