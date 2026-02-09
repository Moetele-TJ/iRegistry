// supabase/functions/get-items/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { hashToken } from "../shared/crypto.ts";

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
    /* ===================== AUTH ===================== */

    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return respond(
        {
          success: false,
          diag: "GET-ITEMS-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const token = auth.replace("Bearer ", "");
    const tokenHash = await hashToken(token);

    const { data: session } = await supabase
      .from("sessions")
      .select("user_id, role, revoked, expires_at")
      .eq("token", tokenHash)
      .maybeSingle();

    if (
      !session ||
      session.revoked ||
      new Date(session.expires_at) < new Date()
    ) {
      return respond(
        {
          success: false,
          diag: "GET-ITEMS-AUTH-002",
          message: "You need to be logged in to perform this task.",
        },
        corsHeaders,
        401
      );
    }

    /* ===================== INPUT ===================== */

    const body = await req.json().catch(() => ({}));

    const {
      includeDeleted = false,
      category,
      make,
      model,
      reportedStolen,
      hasPhotos,
      createdFrom,
      createdTo,
      search,
    } = body;

    let query = supabase
      .from("items")
      .select("*")
      .order("createdon", { ascending: false });

    /* ===================== ROLE RULES ===================== */

    if (session.role === "user") {
      // Own items only
      query = query.eq("ownerid", session.user_id);
    }

    else if (session.role === "police") {
      // Get officer station
      const { data: officer, error } = await supabase
        .from("users")
        .select("police_station")
        .eq("id", session.user_id)
        .single();

      if (error || !officer?.police_station) {
        return respond(
          {
            success: false,
            message: "Police station not configured for this officer",
          },
          corsHeaders,
          403
        );
      }

      // Only stolen items in their jurisdiction
      query = query
        .not("reportedstolenat", "is", null)
        .eq("location", officer.police_station);
    }

    else if (session.role !== "admin" && session.role !== "cashier") {
      return respond(
        {
          success: false,
          message: "You do not have sufficient privileges to perform this task",
        },
        corsHeaders,
        403
      );
    }

    // admin → no ownership restriction

    /* ===================== FILTERS ===================== */

    if (!includeDeleted) query = query.is("deletedat", null);
    if (category) query = query.eq("category", category);
    if (make) query = query.eq("make", make);
    if (model) query = query.eq("model", model);

    if (reportedStolen === true) {
      query = query.not("reportedstolenat", "is", null);
    }

    if (hasPhotos === true) {
      query = query.not("photos", "is", null);
    }

    if (createdFrom) query = query.gte("createdon", createdFrom);
    if (createdTo) query = query.lte("createdon", createdTo);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,serial1.ilike.%${search}%`
      );
    }

    /* ===================== QUERY ===================== */

    const { data, error } = await query;
    if (error) throw error;

    return respond(
      {
        success: true,
        items: data || [],
      },
      corsHeaders,
      200
    );
  } catch (err) {
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