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

    if (!roleIs(session.role, "user") && !roleIs(session.role, "police")) {
      return respond(
        {
          success: false,
          message: "Only registered user or police accounts can manage pending top-ups here.",
        },
        corsHeaders,
        403,
      );
    }

    const uid = session.user_id;

    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action.trim() : "get";

    if (action === "get") {
      const packages = await loadPackages().catch((e) => {
        console.error("user-pending-topup packages:", e?.message || e);
        return [];
      });
      const { data: row, error } = await supabase
        .from("payments")
        .select(
          "id, user_id, channel, status, currency, amount, credits_granted, metadata, created_at, confirmed_at",
        )
        .eq("user_id", uid)
        .eq("status", "PENDING")
        .maybeSingle();

      if (error) {
        console.error("user-pending-topup get:", error.message);
        return respond({ success: false, message: "Failed to load pending top-up" }, corsHeaders, 500);
      }

      return respond({ success: true, pending: row || null, packages }, corsHeaders, 200);
    }

    if (action === "cancel") {
      const { data: updated, error: upErr } = await supabase
        .from("payments")
        .update({ status: "CANCELLED" })
        .eq("user_id", uid)
        .eq("status", "PENDING")
        .select("id")
        .maybeSingle();

      if (upErr) {
        return respond({ success: false, message: "Could not cancel" }, corsHeaders, 500);
      }
      if (!updated) {
        return respond({ success: false, message: "No pending top-up to cancel" }, corsHeaders, 404);
      }
      return respond({ success: true, message: "Pending top-up cancelled." }, corsHeaders, 200);
    }

    if (action !== "save") {
      return respond({ success: false, message: "Unknown action" }, corsHeaders, 400);
    }

    const packages = await loadPackages();
    const packageId = typeof body?.package_id === "string" ? body.package_id.trim() : "";
    const pkg = packages.find((p) => p.id === packageId) ?? null;
    if (!pkg) {
      return respond({ success: false, message: "Invalid package" }, corsHeaders, 400);
    }

    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("user_id", uid)
      .eq("status", "PENDING")
      .maybeSingle();

    const metadata = {
      package_id: pkg.id,
      user_note: note || null,
      kind: "user_pending_topup",
    };

    if (existing?.id) {
      const { data: upd, error: uerr } = await supabase
        .from("payments")
        .update({
          currency: pkg.currency,
          amount: pkg.amount,
          credits_granted: pkg.credits,
          metadata,
        })
        .eq("id", existing.id)
        .eq("user_id", uid)
        .eq("status", "PENDING")
        .select(
          "id, channel, status, currency, amount, credits_granted, metadata, created_at",
        )
        .single();

      if (uerr || !upd) {
        return respond({ success: false, message: "Could not update pending top-up" }, corsHeaders, 500);
      }
      return respond({ success: true, pending: upd, packages }, corsHeaders, 200);
    }

    const { data: ins, error: ierr } = await supabase
      .from("payments")
      .insert({
        user_id: uid,
        channel: "ONLINE",
        status: "PENDING",
        currency: pkg.currency,
        amount: pkg.amount,
        credits_granted: pkg.credits,
        metadata,
      })
      .select("id, channel, status, currency, amount, credits_granted, metadata, created_at")
      .single();

    if (ierr) {
      const em = String(ierr.message || "");
      if (em.includes("idx_payments_one_pending_per_user") || em.includes("duplicate key")) {
        return respond(
          {
            success: false,
            message: "You already have a pending top-up. Update or cancel it first.",
          },
          corsHeaders,
          409,
        );
      }
      console.error("user-pending-topup insert:", ierr);
      return respond({ success: false, message: "Could not create pending top-up" }, corsHeaders, 500);
    }

    return respond({ success: true, pending: ins, packages }, corsHeaders, 200);
  } catch (err: unknown) {
    console.error("user-pending-topup crash:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
