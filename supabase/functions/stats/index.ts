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
        activeUserRows,
        itemCountRows,
      ] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .is("suspended_at", null)
          .is("disabled_at", null),
        supabase.from("items").select("*", { count: "exact", head: true }),
        supabase
          .from("items")
          .select("*", { count: "exact", head: true })
          .not("reportedstolenat", "is", null)
          .is("deletedat", null)
          .is("legacyat", null),
        supabase
          .from("users")
          .select("id")
          .is("deleted_at", null)
          .is("suspended_at", null)
          .is("disabled_at", null),
        supabase.rpc("list_owner_active_item_counts"),
      ]);

      const activeItemCountByOwner = new Map<string, number>();
      for (const row of itemCountRows.data || []) {
        const oid = (row as { owner_id?: string })?.owner_id;
        const c = (row as { item_count?: unknown })?.item_count;
        if (oid == null) continue;
        const n = typeof c === "number" && Number.isFinite(c) ? c : Number(c);
        if (Number.isFinite(n)) activeItemCountByOwner.set(String(oid), Math.max(0, Math.floor(n)));
      }

      let users_without_items = 0;
      for (const u of activeUserRows.data || []) {
        const uid = (u as { id?: string })?.id;
        if (!uid) continue;
        if ((activeItemCountByOwner.get(String(uid)) ?? 0) === 0) users_without_items += 1;
      }

      return respond(
        {
          success: true,
          data: {
            users_total: users.count ?? 0,
            users_active: activeUsers.count ?? 0,
            users_without_items,
            items_total: items.count ?? 0,
            items_stolen: stolenItems.count ?? 0,
            security_alerts: 0,
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