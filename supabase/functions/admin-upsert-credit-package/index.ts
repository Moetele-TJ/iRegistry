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

function normalizeId(id: unknown) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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
    const { id, currency, amount, credits, active, sort_order } = body ?? {};

    const cleanId = normalizeId(id);
    if (!cleanId) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

    const cleanCurrency = String(currency || "BWP").trim().toUpperCase();
    if (!cleanCurrency) return respond({ success: false, message: "currency is required" }, corsHeaders, 400);

    const cleanAmount = Number(amount);
    if (!Number.isFinite(cleanAmount) || cleanAmount < 0) {
      return respond({ success: false, message: "amount must be a number >= 0" }, corsHeaders, 400);
    }

    const cleanCredits = Number(credits);
    if (!Number.isFinite(cleanCredits) || cleanCredits <= 0 || !Number.isInteger(cleanCredits)) {
      return respond({ success: false, message: "credits must be a whole number > 0" }, corsHeaders, 400);
    }

    const cleanSort = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;

    const payload = {
      id: cleanId,
      currency: cleanCurrency,
      amount: cleanAmount,
      credits: cleanCredits,
      active: typeof active === "boolean" ? active : true,
      sort_order: Number.isFinite(cleanSort) ? Math.trunc(cleanSort) : 0,
    };

    const { data, error } = await supabase
      .from("credit_packages")
      .upsert(payload, { onConflict: "id" })
      .select("id, currency, amount, credits, active, sort_order, updated_at")
      .single();

    if (error || !data) {
      return respond({ success: false, message: error?.message || "Failed to save package" }, corsHeaders, 500);
    }

    await logAudit({
      supabase,
      event: "CREDIT_PACKAGE_UPSERTED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "PKG-UP",
      metadata: {
        id: data.id,
        currency: data.currency,
        amount: data.amount,
        credits: data.credits,
        active: data.active,
        sort_order: data.sort_order,
      },
      req,
    });

    return respond({ success: true, package: data }, corsHeaders, 200);
  } catch (err: any) {
    console.error("admin-upsert-credit-package crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

