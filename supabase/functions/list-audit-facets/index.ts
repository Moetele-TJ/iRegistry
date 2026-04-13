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

function uniqSorted(list: string[]) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function isShortCode(s: string) {
  // keep concise diag codes; exclude long/embedded metadata
  if (!s) return false;
  if (s.length > 40) return false;
  if (s.includes(" ")) return false;
  if (s.includes("=")) return false;
  return true;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!roleIs(session.role, "admin")) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 1000, 50), 5000);

    // Pull recent rows and de-dupe in code (avoids needing SQL DISTINCT / views).
    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("event, diag")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return respond({ success: false, message: error.message || "Failed to load facets" }, corsHeaders, 500);
    }

    const events = uniqSorted((rows || []).map((r: any) => String(r?.event || "").trim()).filter(Boolean));
    const codes = uniqSorted(
      (rows || [])
        .map((r: any) => String(r?.diag || "").trim())
        .filter((s) => isShortCode(s)),
    );

    return respond({ success: true, events, codes }, corsHeaders, 200);
  } catch (err: any) {
    console.error("list-audit-facets crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

