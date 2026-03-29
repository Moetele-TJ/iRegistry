// supabase/functions/get-items/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getPagination } from "../shared/pagination.ts";
import { applyItemFilters } from "../shared/itemFilters.ts";
import { getAccessConditions } from "../shared/accessConditions.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

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
    /* ================= INPUT ================= */

    const body = await req.json().catch(() => ({}));

    const {
      ownerId,
      policeStationStolenView,
      page,
      pageSize,
      includeDeleted,
      category,
      make,
      model,
      reportedStolen,
      hasPhotos,
      createdFrom,
      createdTo,
      search,
    } = body ?? {};

    /* ================= PAGINATION ================= */

    const { safePage, safePageSize, from, to } =
      getPagination(page, pageSize);

    /* ================= AUTH ================= */

    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    /* ================= BASE QUERY ================= */

    let query = supabase
      .from("items")
      .select("*", { count: "exact" })
      .order("createdon", { ascending: false });

    /* ================= ACCESS CONTROL ================= */

    const access = await getAccessConditions(supabase, session, {
      policeStationStolenView: policeStationStolenView === true,
    });

    /* ----- Police station stolen queue: open cases at this station (not item.location) ----- */
    if (access.policeCaseQueue && access.policeStation) {
      const station = String(access.policeStation).trim();

      const { data: cases, error: caseErr, count } = await supabase
        .from("item_police_cases")
        .select(
          "id, item_id, status, station, station_source, opened_at, cleared_at, returned_at, notes, evidence",
          { count: "exact" },
        )
        .eq("station", station)
        .neq("status", "ReturnedToOwner")
        .order("opened_at", { ascending: false })
        .range(from, to);

      if (caseErr) throw caseErr;

      const caseRows = cases || [];
      const ids = caseRows.map((c) => c.item_id);
      const caseByItemId = new Map(caseRows.map((c) => [c.item_id, c]));

      if (ids.length === 0) {
        return respond(
          {
            success: true,
            items: [],
            pagination: {
              page: safePage,
              pageSize: safePageSize,
              total: count ?? 0,
              totalPages: Math.ceil((count ?? 0) / safePageSize) || 0,
            },
          },
          corsHeaders,
          200,
        );
      }

      const { data: itemRows, error: itemErr } = await supabase
        .from("items")
        .select("*")
        .in("id", ids)
        .is("deletedat", null);

      if (itemErr) throw itemErr;

      const itemMap = new Map((itemRows || []).map((r) => [r.id, r]));
      const ordered = ids
        .map((id) => {
          const row = itemMap.get(id);
          if (!row) return null;
          const pc = caseByItemId.get(id);
          return { ...row, police_case: pc };
        })
        .filter(Boolean);

      return respond(
        {
          success: true,
          items: ordered,
          pagination: {
            page: safePage,
            pageSize: safePageSize,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / safePageSize) || 0,
          },
        },
        corsHeaders,
        200,
      );
    }

    if (access.forceEmpty) {
      query = query.eq("id", "__NO_MATCH__");
    }

    if ("ownerid" in access) {
      query = query.eq("ownerid", access.ownerid);
    }

    if ("deletedat" in access && access.deletedat === null) {
      query = query.is("deletedat", null);
    }

    if (access.reportedstolenat === "NOT_NULL") {
      query = query.not("reportedstolenat", "is", null);
    }

    /* ================= PRIVILEGED OWNER FILTER =================
     * Admin/cashier users can choose which user's items to view.
     * We only apply this when the session role is privileged.
     */
    if (isPrivilegedRole(session?.role) && ownerId) {
      query = query.eq("ownerid", ownerId);
    }

    /* ================= FILTERS ================= */

    query = applyItemFilters(query, {
      includeDeleted,
      category,
      make,
      model,
      reportedStolen,
      hasPhotos,
      createdFrom,
      createdTo,
      search,
    });

    console.log("createdFrom:", createdFrom);
    console.log("createdTo:", createdTo);

    /* ================= EXECUTE ================= */

    const { data, error, count } = await query.range(from,to);

    if (error) throw error;

    return respond(
      {
        success: true,
        items: data || [],
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / safePageSize),
        },
      },
      corsHeaders,
      200
    );

  } catch (err: any) {
    console.error("get-items crash:", err);

    return respond(
      {
        success: false,
        message: err.message || "Failed to fetch items",
      },
      corsHeaders,
      500
    );
  }
});