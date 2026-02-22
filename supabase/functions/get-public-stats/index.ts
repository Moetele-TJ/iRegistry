// supabase/functions/get-public-stats/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* ================= TOTAL COUNTS ================= */

    const { count: totalItems } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .is("deletedat", null);

    const { count: stolenItems } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("status", "Stolen")
      .is("deletedat", null);

    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    /* ================= CATEGORY BREAKDOWN ================= */

    const { data: categoryRows } = await supabase
      .from("items")
      .select("category")
      .is("deletedat", null);

    const categoryBreakdown: Record<string, number> = {};

    for (const row of categoryRows ?? []) {
      const cat = row.category || "Other";
      categoryBreakdown[cat] =
        (categoryBreakdown[cat] || 0) + 1;
    }

    /* ================= STATUS BREAKDOWN ================= */

    const statusBreakdown = {
      Active: (totalItems ?? 0) - (stolenItems ?? 0),
      Stolen: stolenItems ?? 0,
    };

    /* ================= MONTHLY TREND ================= */

    const { data: monthlyRows } = await supabase
      .from("items")
      .select("createdon")
      .is("deletedat", null);

    const monthlyTrend: Record<string, number> = {};

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      monthlyTrend[key] = 0;
    }

    for (const row of monthlyRows ?? []) {
      const date = new Date(row.createdon);
      const key = date.toISOString().slice(0, 7);
      if (monthlyTrend[key] !== undefined) {
        monthlyTrend[key]++;
      }
    }

    /* ================= RESPONSE ================= */

    return respond(
      {
        success: true,
        stats: {
          totals: {
            totalItems: totalItems ?? 0,
            stolenItems: stolenItems ?? 0,
            activeItems: statusBreakdown.Active,
            totalUsers: totalUsers ?? 0,
          },
          categoryBreakdown,
          statusBreakdown,
          monthlyTrend,
        },
      },
      corsHeaders,
      200
    );

  } catch (err) {
    console.error("get-public-stats crash:", err);

    return respond(
      {
        success: false,
        message: "Failed to load public statistics",
      },
      corsHeaders,
      500
    );
  }
});