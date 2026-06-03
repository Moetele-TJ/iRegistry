// supabase/functions/get-dashboard-data/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";
import { getPoliceCaseActivity } from "../shared/getPoliceCaseActivity.ts";
import { isActivityVisibleToViewer } from "../shared/activityVisibility.ts";
import { resolveActivityActorRole } from "../shared/resolveActivityActorRole.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function displayName(row: any) {
  const f = String(row?.first_name || "").trim();
  const l = String(row?.last_name || "").trim();
  const full = `${f} ${l}`.trim();
  return full || String(row?.email || "").trim() || (row?.id ? String(row.id) : "—");
}

const PERSONAL_ACTIVITY_SELECT = `
  id,
  actor_id,
  actor_role,
  entity_type,
  entity_id,
  entity_name,
  action,
  message,
  metadata,
  created_at
`;

async function fetchFilteredPersonalActivity(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  role: string,
  itemIds: string[],
  page: number,
  limit: number,
) {
  const batchSize = Math.max(limit * 5, 25);
  const maxScan = 2000;
  const allVisible: Record<string, unknown>[] = [];
  let dbOffset = 0;

  while (dbOffset < maxScan) {
    let q = supabaseClient
      .from("unified_activity_feed")
      .select(PERSONAL_ACTIVITY_SELECT)
      .order("created_at", { ascending: false })
      .range(dbOffset, dbOffset + batchSize - 1);

    if (itemIds.length > 0) {
      q = q.or(`actor_id.eq.${userId},entity_id.in.(${itemIds.join(",")})`);
    } else {
      q = q.eq("actor_id", userId);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    for (const row of rows) {
      if (isActivityVisibleToViewer(row as any, userId, role)) {
        allVisible.push(row);
      }
    }

    dbOffset += rows.length;
    if (rows.length < batchSize) break;
  }

  const targetStart = (page - 1) * limit;
  return {
    pageData: allVisible.slice(targetStart, targetStart + limit),
    total: allVisible.length,
  };
}

async function attachActorDetails(supabaseClient: any, rows: any[]) {
  const list = Array.isArray(rows) ? rows : [];
  const actorIds = Array.from(
    new Set(
      list
        .map((r) => (r && typeof r === "object" ? (r as any).actor_id : null))
        .filter((id) => typeof id === "string" && id.trim()),
    ),
  );

  if (actorIds.length === 0) return list;

  const itemIds = Array.from(
    new Set(
      list
        .filter((r) => r?.entity_type === "item" && r?.entity_id)
        .map((r) => String((r as { entity_id: string }).entity_id)),
    ),
  );

  const ownerByItemId = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await supabaseClient
      .from("items")
      .select("id, ownerid")
      .in("id", itemIds);
    for (const it of items || []) {
      if (it?.id && it?.ownerid) {
        ownerByItemId.set(String(it.id), String(it.ownerid));
      }
    }
  }

  const { data: users } = await supabaseClient
    .from("users")
    .select("id, first_name, last_name, email, role")
    .in("id", actorIds);

  const byId = new Map<string, any>();
  for (const u of users || []) {
    if (u?.id) byId.set(String(u.id), u);
  }

  return list.map((r) => {
    const id = r?.actor_id ? String(r.actor_id) : "";
    const u = id ? byId.get(id) : null;
    const meta =
      r?.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {};
    const resourceOwner =
      r?.entity_type === "item" && r?.entity_id
        ? ownerByItemId.get(String(r.entity_id)) ??
          (meta.ownerId as string | undefined) ??
          (meta.owner_id as string | undefined)
        : r?.entity_type === "user" && r?.entity_id
        ? String(r.entity_id)
        : null;
    const rawRole = String(r?.actor_role || u?.role || "").trim() || null;
    const displayRole = rawRole
      ? resolveActivityActorRole(rawRole, id, resourceOwner)
      : null;

    return {
      ...r,
      actor: u
        ? {
            id: String(u.id),
            role: displayRole,
            display_name: displayName(u),
            email: u.email || null,
          }
        : r?.actor_id
        ? {
            id: String(r.actor_id),
            role: displayRole ?? r?.actor_role ?? null,
            display_name: String(r.actor_id),
            email: null,
          }
        : null,
    };
  });
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

    const { data: itemStats } = await supabase
      .from("items")
      .select("reportedstolenat")
      .eq("ownerid", userId)
      .is("deletedat", null)
      .is("legacyat", null);

    let activeItems = 0;
    let stolenItems = 0;

    (itemStats || []).forEach((item: any) => {
      if (item.reportedstolenat) stolenItems++;
      else activeItems++;
    });

    const { data: notificationStats } = await supabase
      .from("item_notifications")
      .select("isread")
      .eq("ownerid", userId)
      .eq("recipient_type", "owner");

    let totalNotifications = notificationStats?.length || 0;
    let unreadNotifications = notificationStats?.filter(n => !n.isread).length || 0;

    /* ================================
      ALERTS (RECENT NOTIFICATIONS)
    =================================*/

    const { data: alerts } = await supabase
      .from("item_notifications")
      .select(`
        id,
        itemid,
        message,
        contact,
        recipient_type,
        isread,
        createdon,
        items(name,slug)
      `)
      .eq("ownerid", userId)
      .eq("recipient_type","owner")
      .order("createdon", { ascending: false })
      .limit(5);

    const { data: userItems } = await supabase
      .from("items")
      .select("id")
      .eq("ownerid", userId)
      .is("deletedat", null);

    const itemIds = (userItems || []).map(i => i.id);

    const { pageData: personalActivityRaw, total: personalCount } =
      await fetchFilteredPersonalActivity(
        supabase,
        userId,
        role,
        itemIds,
        safePage,
        safeLimit,
      );
    const personalActivity = await attachActorDetails(supabase, personalActivityRaw);

    const personal = {
      summary: {
        activeItems: activeItems ?? 0,
        stolenItems: stolenItems ?? 0,
        notifications: totalNotifications ?? 0,
        unreadNotifications: unreadNotifications ?? 0,
      },

      alerts: alerts ?? [],

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
        .from("unified_activity_feed")
        .select(
          `
            id,
            actor_id,
            actor_role,
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
        .order("created_at", { ascending: false })
        .range(offset, offset + safeLimit - 1);

      const systemActivityEnriched = await attachActorDetails(supabase, roleActivity ?? []);
      roleData.systemActivity = {
        data: systemActivityEnriched ?? [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: roleCount ?? 0,
          totalPages: Math.max(1, Math.ceil((roleCount ?? 0) / safeLimit)),
        },
      };
    }

    if (roleIs(role, "cashier")) {
      const { count: activeUsers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("suspended_at", null)
        .is("disabled_at", null);

      const { data: estRows } = await supabase
        .from("items")
        .select("estimatedvalue")
        .is("deletedat", null);

      let totalEstimatedValue = 0;
      let itemsWithEstimate = 0;
      for (const row of estRows || []) {
        const v = (row as { estimatedvalue?: unknown }).estimatedvalue;
        if (v == null || v === "") continue;
        const n = Number(v);
        if (Number.isFinite(n)) {
          totalEstimatedValue += n;
          itemsWithEstimate += 1;
        }
      }

      const { count: highSeverityAudits } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("severity", "high");

      const { data: pendingPaymentRows } = await supabase
        .from("payments")
        .select("id, metadata")
        .eq("status", "PENDING");

      const pendingTopupRequests = (pendingPaymentRows || []).filter((row) => {
        const meta = (row as { metadata?: { kind?: string } }).metadata;
        return meta?.kind === "user_pending_topup";
      }).length;

      roleData.cashierOverview = {
        activeUsers: activeUsers ?? 0,
        totalEstimatedValue,
        itemsWithEstimate,
        averageEstimatedValue:
          itemsWithEstimate > 0 ? totalEstimatedValue / itemsWithEstimate : 0,
        highSeverityAudits: highSeverityAudits ?? 0,
        pendingTopupRequests,
      };
    }

    if (roleIs(role, "police")) {
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
    console.error("get-dashboard-data crash:", err);
    const message =
      err instanceof Error && err.message ? err.message : "Unexpected server error";
    return respond(
      {
        success: false,
        message,
      },
      corsHeaders,
      500,
    );
  }
});