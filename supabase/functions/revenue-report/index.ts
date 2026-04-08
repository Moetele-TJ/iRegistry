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

function roleOf(r: unknown) {
  return String(r || "").toLowerCase();
}

function parseDateOnly(s: unknown) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  // expects YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    const role = roleOf(session.role);
    const isAdmin = role === "admin";
    const isCashier = role === "cashier";
    if (!isAdmin && !isCashier) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { from, to, cashier_user_id, channels, include_transactions, limit = 200 } = body ?? {};

    const fromD = parseDateOnly(from);
    const toD = parseDateOnly(to);
    if (!fromD || !toD) {
      return respond(
        { success: false, message: "from/to must be YYYY-MM-DD" },
        corsHeaders,
        400,
      );
    }

    // Inclusive date range in UTC: [from, to+1day)
    const start = new Date(fromD);
    const end = new Date(toD);
    end.setUTCDate(end.getUTCDate() + 1);

    // channels can be: ["CASHIER"], ["ONLINE"], or both
    const channelListRaw = Array.isArray(channels) ? channels : ["CASHIER"];
    const channelList = channelListRaw
      .map((c) => String(c || "").toUpperCase())
      .filter((c) => c === "CASHIER" || c === "ONLINE");
    const finalChannels: string[] = channelList.length ? channelList : ["CASHIER"];

    let cashierId = null as string | null;
    if (isCashier) {
      cashierId = String(session.user_id);
      // Cashiers can only see cashier-channel payments they executed
      finalChannels.splice(0, finalChannels.length, "CASHIER");
    } else if (typeof cashier_user_id === "string" && cashier_user_id.trim()) {
      cashierId = cashier_user_id.trim();
    }

    let q = supabase
      .from("payments")
      .select(
        "id, user_id, channel, status, currency, amount, credits_granted, receipt_no, provider, provider_reference, cashier_user_id, confirmed_at, created_at",
        { count: "exact" },
      )
      .eq("status", "CONFIRMED")
      .is("reversed_at", null)
      .gte("confirmed_at", start.toISOString())
      .lt("confirmed_at", end.toISOString());

    if (finalChannels.length === 1) {
      q = q.eq("channel", finalChannels[0]);
    } else {
      q = q.in("channel", finalChannels);
    }

    if (cashierId) q = q.eq("cashier_user_id", cashierId);

    q = q.order("confirmed_at", { ascending: false }).limit(Math.min(Number(limit) || 200, 5000));

    const { data, error, count } = await q;
    if (error) return respond({ success: false, message: error.message || "Failed to compute report" }, corsHeaders, 500);

    // aggregate in code (small volume; can move to SQL later)
    const byCurrency: Record<string, { amount: number; count: number }> = {};
    for (const row of data || []) {
      const cur = String((row as any).currency || "BWP").toUpperCase();
      const amt = Number((row as any).amount ?? 0);
      if (!Number.isFinite(amt)) continue;
      if (!byCurrency[cur]) byCurrency[cur] = { amount: 0, count: 0 };
      byCurrency[cur].amount += amt;
      byCurrency[cur].count += 1;
    }

    return respond(
      {
        success: true,
        scope: {
          from: String(from),
          to: String(to),
          cashier_user_id: cashierId,
          channels: finalChannels,
        },
        totals: {
          count: count ?? (data || []).length,
          by_currency: byCurrency,
        },
        transactions: include_transactions ? (data || []) : undefined,
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("revenue-report crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

