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

/** Owner identity fields for staff-only visibility in the UI. */
async function enrichItemsWithOwnerIdentity(
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const list = rows || [];
  const ownerIds = [
    ...new Set(
      list
        .map((r) => r?.ownerid)
        .filter((id): id is string => typeof id === "string" && !!id.trim()),
    ),
  ];
  if (ownerIds.length === 0) return list;

  const { data: userRows, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, id_number")
    .in("id", ownerIds);

  if (error) {
    console.error("get-items owner identity:", error.message);
    return list;
  }

  const byId = new Map(
    (userRows || []).map(
      (u: {
        id?: string;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        id_number?: string | null;
      }) => [
        u.id,
        {
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          email: u.email ?? null,
          id_number: u.id_number ?? null,
        },
      ],
    ),
  );

  return list.map((row) => {
    const oid = row?.ownerid;
    const id = typeof oid === "string" ? oid : null;
    const ident = id ? byId.get(id) ?? null : null;
    return {
      ...row,
      owner_first_name: ident?.first_name ?? null,
      owner_last_name: ident?.last_name ?? null,
      owner_email: ident?.email ?? null,
      owner_id_number: ident?.id_number ?? null,
    };
  });
}

/** Owner role + credit balance for billing preflight in the UI (mirrors update-item billToUserId). */
async function enrichItemsWithOwnerBilling(
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const list = rows || [];
  const ownerIds = [
    ...new Set(
      list
        .map((r) => r?.ownerid)
        .filter((id): id is string => typeof id === "string" && !!id.trim()),
    ),
  ];
  if (ownerIds.length === 0) return list;

  const [{ data: userRows, error: uErr }, { data: creditRows, error: cErr }] =
    await Promise.all([
      supabase.from("users").select("id, role").in("id", ownerIds),
      supabase.from("user_credits").select("user_id, balance").in("user_id", ownerIds),
    ]);

  if (uErr) console.error("get-items owner roles:", uErr.message);
  if (cErr) console.error("get-items owner credits:", cErr.message);

  const roleBy = new Map(
    (userRows || []).map((u: { id?: string; role?: string }) => [
      u.id,
      u.role ?? null,
    ]),
  );
  const balBy = new Map(
    (creditRows || []).map((c: { user_id?: string; balance?: number }) => [
      c.user_id,
      typeof c.balance === "number" ? c.balance : 0,
    ]),
  );

  return list.map((row) => {
    const oid = row?.ownerid;
    const id = typeof oid === "string" ? oid : null;
    return {
      ...row,
      owner_role: id ? (roleBy.get(id) ?? null) : null,
      owner_credit_balance: id ? (balBy.get(id) ?? 0) : 0,
    };
  });
}

async function enrichItemsWithOwnerOrgSlug(
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const list = rows || [];
  const orgIds = [
    ...new Set(
      list
        .map((r) => r?.owner_org_id)
        .filter((id): id is string => typeof id === "string" && !!id.trim()),
    ),
  ];
  if (orgIds.length === 0) return list;

  const { data: orgRows, error } = await supabase
    .from("orgs")
    .select("id, slug")
    .in("id", orgIds);

  if (error) console.error("get-items org slugs:", error.message);

  const slugBy = new Map(
    (orgRows || []).map((o: { id: string; slug?: string | null }) => [
      String(o.id),
      o.slug ?? null,
    ]),
  );

  return list.map((row) => {
    const oid = row?.owner_org_id;
    const id = typeof oid === "string" ? oid : null;
    return {
      ...row,
      owner_org_slug: id ? slugBy.get(id) ?? null : null,
    };
  });
}

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
      deletedOnly,
      includeLegacy,
      legacyOnly,
      category,
      make,
      model,
      reportedStolen,
      hasPhotos,
      createdFrom,
      createdTo,
      search,
      /** Exact match by primary key or public slug (detail/edit pages when the item is not in the current list). */
      itemLookup,
    } = body ?? {};

    /* ================= PAGINATION ================= */

    const { safePage, safePageSize, from, to } =
      getPagination(page, pageSize);

    /* ================= AUTH ================= */

    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) {
      return respond(
        {
          success: false,
          message: "Unauthorized",
        },
        corsHeaders,
        401,
      );
    }

    /* ================= BASE QUERY ================= */

    let query = supabase
      .from("items")
      .select("*", { count: "exact" })
      .order("createdon", { ascending: false });

    /* ================= ACCESS CONTROL ================= */

    const access = await getAccessConditions(supabase, session, {
      policeStationStolenView: policeStationStolenView === true,
    });

    /* ----- Police station stolen queue: stolen items where items.station matches officer station ----- */
    if (access.policeCaseQueue && access.policeStation) {
      const station = String(access.policeStation).trim();

      const { data: stationItems, error: stationItemsErr, count } = await supabase
        .from("items")
        .select("*", { count: "exact" })
        .is("deletedat", null)
        .not("reportedstolenat", "is", null)
        .ilike("station", station)
        .order("reportedstolenat", { ascending: false })
        .range(from, to);

      if (stationItemsErr) throw stationItemsErr;

      const rows = stationItems || [];
      if (rows.length === 0) {
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

      const itemIds = rows
        .map((r) => r?.id)
        .filter((id): id is string => typeof id === "string" && !!id);

      const { data: openCases, error: caseErr } = await supabase
        .from("item_police_cases")
        .select(
          "id, item_id, status, station, station_source, opened_at, cleared_at, returned_at, notes, evidence",
        )
        .in("item_id", itemIds)
        .neq("status", "ReturnedToOwner");

      if (caseErr) throw caseErr;

      const caseByItemId = new Map(
        (openCases || []).map((c) => [String(c.item_id), c]),
      );
      const orderedRaw = rows.map((row) => ({
        ...row,
        police_case: caseByItemId.get(String(row.id)) ?? null,
      }));

      const ordered = await enrichItemsWithOwnerOrgSlug(
        await enrichItemsWithOwnerBilling(orderedRaw as Record<string, unknown>[]),
      );

      const withOwnerIdentity = isPrivilegedRole(session?.role)
        ? await enrichItemsWithOwnerIdentity(
            ordered as Record<string, unknown>[],
          )
        : ordered;

      return respond(
        {
          success: true,
          items: withOwnerIdentity,
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

    if (typeof itemLookup === "string" && itemLookup.trim()) {
      const raw = itemLookup.trim();
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRe.test(raw)) {
        query = query.eq("id", raw);
      } else {
        query = query.eq("slug", raw);
      }
    }

    /* ================= FILTERS ================= */

    query = applyItemFilters(query, {
      includeDeleted,
      deletedOnly,
      includeLegacy,
      legacyOnly,
      category,
      make,
      model,
      reportedStolen,
      hasPhotos,
      createdFrom,
      createdTo,
      search,
    });

    /* ================= EXECUTE ================= */

    const { data, error, count } = await query.range(from,to);

    if (error) throw error;

    const enrichedBase = await enrichItemsWithOwnerOrgSlug(
      await enrichItemsWithOwnerBilling((data || []) as Record<string, unknown>[]),
    );

    const enriched = isPrivilegedRole(session?.role)
      ? await enrichItemsWithOwnerIdentity(
          enrichedBase as Record<string, unknown>[],
        )
      : enrichedBase;

    return respond(
      {
        success: true,
        items: enriched,
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