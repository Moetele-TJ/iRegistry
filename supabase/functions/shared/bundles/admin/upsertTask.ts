import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../../cors.ts";
import { respond } from "../../respond.ts";
import { validateSession } from "../../validateSession.ts";
import { logAudit } from "../../logAudit.ts";
import { roleIs } from "../../roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizeCode(code: unknown) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function run(req: Request): Promise<Response> {
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
    const { code, name, description, credits_cost, active } = body ?? {};

    const cleanCode = normalizeCode(code);
    if (!cleanCode) return respond({ success: false, message: "code is required" }, corsHeaders, 400);

    const cleanName = String(name || "").trim();
    if (!cleanName) return respond({ success: false, message: "name is required" }, corsHeaders, 400);

    const cost = Number(credits_cost);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isInteger(cost)) {
      return respond({ success: false, message: "credits_cost must be a whole number >= 0" }, corsHeaders, 400);
    }

    const payload: Record<string, any> = {
      code: cleanCode,
      name: cleanName,
      description: typeof description === "string" ? description.trim() || null : null,
      credits_cost: cost,
      active: typeof active === "boolean" ? active : true,
    };

    const { data, error } = await supabase
      .from("task_catalog")
      .upsert(payload, { onConflict: "code" })
      .select("code, name, description, credits_cost, active, updated_at")
      .single();

    if (error || !data) {
      return respond({ success: false, message: error?.message || "Failed to save task" }, corsHeaders, 500);
    }

    await logAudit({
      supabase,
      event: "TASK_UPSERTED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "TASK-UP",
      metadata: {
        code: data.code,
        credits_cost: data.credits_cost,
        active: data.active,
      },
      req,
    });

    return respond({ success: true, task: data }, corsHeaders, 200);
  } catch (err: any) {
    console.error("admin-upsert-task crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
}