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

    const access = await getAccessConditions(supabase, session);

    if (access.forceEmpty) {
      query = query.eq("id", "__NO_MATCH__");
    }

    if ("ownerid" in access) {
      query = query.eq("ownerid", access.ownerid);
    }

    if ("location" in access) {
      query = query.eq("location", access.location);
    }

    if ("deletedat" in access && access.deletedat === null) {
      query = query.is("deletedat", null);
    }

    if (access.reportedstolenat === "NOT_NULL") {
      query = query.not("reportedstolenat", "is", null);
    }

    console.log("QUERY TYPE:", typeof query);
    console.log("HAS EQ:", typeof (query as any)?.eq);
    console.log("HAS IS:", typeof (query as any)?.is);

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