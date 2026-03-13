//  supabase/functions/get-notifications/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

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

    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success: false, message: "Invalid session" },
        corsHeaders,
        401
      );
    }

    const userId = session.user_id;

    const body = await req.json().catch(() => ({}));

    const {
      limit = 50,
      page = 1
    } = body;

    const safeLimit = Math.min(Number(limit) || 50, 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const { data: notifications, count } = await supabase
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
      `, { count: "exact" })
      .eq("ownerid", userId)
      .eq("recipient_type", "owner")
      .order("createdon", { ascending: false })
      .range(offset, offset + safeLimit - 1);

    return respond(
      {
        success: true,
        notifications: notifications ?? [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: count ?? 0,
          totalPages: Math.max(1, Math.ceil((count ?? 0) / safeLimit))
        }
      },
      corsHeaders,
      200
    );

  } catch (err) {

    console.error("get-notifications crash:", err);

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