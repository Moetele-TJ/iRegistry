// supabase/functions/stats/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

/* ---------------- SUPABASE CLIENT ---------------- */

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/* ---------------- MAIN ---------------- */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  /* 🔥 Preflight */
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") ?? "public";

    const supabase = getSupabase();

    /* ================= PUBLIC STATS ================= */
    if (mode === "public") {
      const { count: registeredItems } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true });

      const { count: activeItems } = await supabase
        .from("items")
        .select("Active", { count: "exact", head: true });

      return respond(
        {
          success: true,
          data: {
            registered_items: registeredItems ?? 0,
          },
        },
        corsHeaders
      );
    }

    /* ================= ADMIN STATS ================= */
    if (mode === "admin") {
      // 🔐 Require Authorization header
      const auth = req.headers.get("authorization");
      if (!auth) {
        return respond(
          { success: false, message: "Unauthorized" },
          corsHeaders,
          401
        );
      }

      const [
        users,
        activeUsers,
        items,
        stolenItems,
        highAlerts,
      ] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase.from("items").select("*", { count: "exact", head: true }),
        supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .eq("status", "Stolen"),
        /*supabase
          .from("audit_logs")
          .select("*", { count: "exact", head: true })
          .eq("severity", "high"),*/
      ]);

      return respond(
        {
          success: true,
          data: {
            users_total: users.count ?? 0,
            users_active: activeUsers.count ?? 0,
            items_total: items.count ?? 0,
            items_stolen: stolenItems.count ?? 0,
            security_alerts: highAlerts.count ?? 0,
          },
        },
        corsHeaders
      );
    }

    /* ================= UNKNOWN MODE ================= */
    return respond(
      {
        success: false,
        message: "Invalid stats mode",
      },
      corsHeaders,
      400
    );
  } catch (err) {
    console.error("stats error:", err);

    return respond(
      {
        success: false,
        message: "Server error",
      },
      corsHeaders,
      500
    );
  }
});