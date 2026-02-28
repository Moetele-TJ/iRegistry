// supabase/functions/get-dashboard-data/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";
import { getPoliceCaseActivity } from "../shared/getPoliceCaseActivity.ts"

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
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { 
          success: false,
          message: "Invalid session"
        },
        corsHeaders,
        401
      );
    }

    const userId = session.user_id;
    const role = session.role;

    console.log("DASHBOARD USER:", userId);

    const body = await req.json().catch(() => ({}));

    const {
      limit = 5,
      page = 1,
    } = body;

    const safeLimit = Math.min(Number(limit) || 5, 50);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    /* ================================
       1️⃣ PERSONAL SCOPE (ALWAYS)
    =================================*/

    const { count: activeItems } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("ownerid", userId)
      .eq("status", "Active")
      .is("deletedat", null);

    const { count: stolenItems } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("ownerid", userId)
      .eq("status", "Stolen")
      .is("deletedat", null);

    const { count: totalNotifications } = await supabase
      .from("item_notifications")
      .select("*", { count: "exact", head: true })
      .eq("ownerid", userId);

    const { count: unreadNotifications } = await supabase
      .from("item_notifications")
      .select("*", { count: "exact", head: true })
      .eq("ownerid", userId)
      .eq("isread", false);

    const { data: personalActivity, count: personalCount } = await supabase
      .from("activity_logs")
      .select(
        `
          id,
          entity_type,
          entity_id,
          entity_name,
          action,
          message,
          metadata,
          created_at
        `,
        { count: "exact" }
      )
      .eq("actor_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + safeLimit - 1);

    const personal = {
      summary: {
        activeItems: activeItems ?? 0,
        stolenItems: stolenItems ?? 0,
        notifications: totalNotifications ?? 0,
        unreadNotifications: unreadNotifications ?? 0,
      },
      activity: {
        data: personalActivity ?? [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: personalCount ?? 0,
          totalPages: Math.max(1, Math.ceil((personalCount ?? 0) / safeLimit)),
        },
      },
    };

    /* ================================
       2️⃣ ROLE LAYER (OPTIONAL)
    =================================*/

    let roleData: Record<string, any> = {};
    const isPrivileged = isPrivilegedRole(role);

    if (isPrivileged) {
      const { count: totalUsers } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);

      const { count: totalItems } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .is("deletedat", null);

      roleData.adminOverview = {
        totalUsers: totalUsers ?? 0,
        totalItems: totalItems ?? 0,
      };

      const { data: roleActivity, count: roleCount } = await supabase
        .from("activity_logs")
        .select(
          `
            id,
            entity_type,
            entity_id,
            entity_name,
            action,
            message,
            metadata,
            created_at
          `,
          { count: "exact" }
        )
        .neq("actor_id", userId) // exclude own actions
        .order("created_at", { ascending: false })
        .range(offset, offset + safeLimit - 1);

      roleData.roleActivity = {
        data: roleActivity ?? [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: roleCount ?? 0,
          totalPages: Math.ceil((roleCount ?? 0) / safeLimit),
        },
      };
    }

    if (role === "police") {
      const station = await getPoliceStation(supabase, userId);

      if (!station) {
        return respond(
          {
            success: false,
            message: "No police station attached to this account",
          },
          corsHeaders,
          403
        );
      }

      const caseData = await getPoliceCaseActivity(supabase, {
        station,
        limit: safeLimit,
        page: safePage,
      });

      roleData.policeOverview = {
        station,
        openStolenCases: caseData.openCases,
        caseActivity: caseData.activity,
        pagination: caseData.pagination,
      };
    }

    /* ================================
       3️⃣ RETURN LAYERED RESPONSE
    =================================*/

    return respond(
      {
        success: true,
        personal,
        roleData,
      },
      corsHeaders,
      200
    );

  } catch (err) {
    return respond(
      { 
        success: false,
        message: "Unexpected server error"
      },
      corsHeaders,
      500
    );
  }
});