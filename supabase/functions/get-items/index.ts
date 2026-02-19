// supabase/functions/get-items/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getPagination } from "../shared/pagination.ts";
import { applyItemFilters } from "../shared/itemFilters.ts";
import { applyItemAccessControl } from "../shared/accessControlQuery.ts";

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
      .order("createdon", { ascending: false })
      .range(from, to);

    /* ================= ACCESS CONTROL ================= */

    query = await applyItemAccessControl(
      supabase,
      query,
      session
    );

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

    /* ================= EXECUTE ================= */

    const { data, error, count } = await query;

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