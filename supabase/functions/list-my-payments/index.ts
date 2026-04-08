import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    const body = await req.json().catch(() => ({}));
    const { limit = 50, offset = 0 } = body ?? {};

    const { data, error, count } = await supabase
      .from("payments")
      .select(
        `
        id,
        channel,
        status,
        currency,
        amount,
        credits_granted,
        receipt_no,
        provider,
        provider_reference,
        created_at,
        confirmed_at,
        reversed_at,
        reversed_reason
      `,
        { count: "exact" },
      )
      .eq("user_id", session.user_id)
      .order("created_at", { ascending: false })
      .range(Number(offset) || 0, (Number(offset) || 0) + Math.min(Number(limit) || 50, 200) - 1);

    if (error) return respond({ success: false, message: error.message || "Failed to list payments" }, corsHeaders, 500);

    return respond(
      {
        success: true,
        payments: data || [],
        total: count ?? 0,
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("list-my-payments crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

