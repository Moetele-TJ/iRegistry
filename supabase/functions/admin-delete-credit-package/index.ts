import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { logAudit } from "../shared/logAudit.ts";
import { roleIs } from "../shared/roles.ts";

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
    if (!roleIs(session.role, "admin")) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id.trim().toUpperCase() : "";
    if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

    const { data: deleted, error } = await supabase
      .from("credit_packages")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return respond({ success: false, message: error.message || "Failed to delete package" }, corsHeaders, 500);
    }
    if (!deleted) {
      return respond({ success: false, message: "Package not found" }, corsHeaders, 404);
    }

    await logAudit({
      supabase,
      event: "CREDIT_PACKAGE_DELETED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "PKG-DEL",
      metadata: { id },
      req,
    });

    return respond({ success: true, id }, corsHeaders, 200);
  } catch (err: any) {
    console.error("admin-delete-credit-package crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

