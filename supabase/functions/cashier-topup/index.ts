import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function loadPackages() {
  const { data, error } = await supabase
    .from("credit_packages")
    .select("id, currency, amount, credits, active, sort_order, updated_at")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("amount", { ascending: true });

  if (error) throw new Error(error.message || "Failed to load packages");
  return (data || []).map((p) => ({
    id: p.id,
    currency: p.currency,
    amount: Number(p.amount ?? 0),
    credits: Number(p.credits ?? 0),
  }));
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    if (!isPrivilegedRole(session.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const body = await req.json().catch(() => null);
    const { user_id, package_id, receipt_no, note } = body ?? {};

    if (!user_id || typeof user_id !== "string") {
      return respond({ success: false, message: "user_id is required" }, corsHeaders, 400);
    }
    if (!package_id || typeof package_id !== "string") {
      return respond({ success: false, message: "package_id is required" }, corsHeaders, 400);
    }
    if (!receipt_no || typeof receipt_no !== "string" || !receipt_no.trim()) {
      return respond({ success: false, message: "receipt_no is required" }, corsHeaders, 400);
    }

    const packages = await loadPackages();
    const pkg = packages.find((p) => p.id === package_id) ?? null;
    if (!pkg) {
      return respond({ success: false, message: "Invalid package_id" }, corsHeaders, 400);
    }

    const { data: targetUser } = await supabase
      .from("users")
      .select("id, status, deleted_at")
      .eq("id", user_id)
      .maybeSingle();

    if (!targetUser || targetUser.deleted_at) {
      return respond({ success: false, message: "User not found" }, corsHeaders, 404);
    }

    // Single DB transaction: payment row + ledger credit (see cashier_confirm_topup migration).
    const { data: topupRows, error: topupErr } = await supabase.rpc("cashier_confirm_topup", {
      p_target_user_id: user_id,
      p_currency: pkg.currency,
      p_amount: pkg.amount,
      p_credits_granted: pkg.credits,
      p_cashier_user_id: session.user_id,
      p_receipt_no: receipt_no.trim(),
      p_metadata: {
        kind: "cashier-topup",
        package_id: pkg.id,
        receipt_no: receipt_no.trim(),
        note: typeof note === "string" ? note.trim() : null,
      },
    });

    if (topupErr || !topupRows?.length) {
      const em = String(topupErr?.message || "");
      return respond(
        {
          success: false,
          message: em.includes("ADD_CREDITS_FAILED") || em.includes("INVALID_PAYLOAD")
            ? "Failed to complete top-up"
            : em || "Failed to complete top-up",
        },
        corsHeaders,
        500,
      );
    }

    const row = topupRows[0] as { payment_id: string; new_balance: number };
    const payment = {
      id: row.payment_id,
      user_id,
      credits_granted: pkg.credits,
      currency: pkg.currency,
      amount: pkg.amount,
      receipt_no: receipt_no.trim(),
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    };

    return respond(
      {
        success: true,
        payment,
        credits_added: pkg.credits,
        new_balance: row.new_balance ?? null,
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("cashier-topup crash:", err);
    return respond(
      { success: false, message: err?.message || "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});

