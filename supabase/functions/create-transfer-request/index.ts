// supabase/functions/create-transfer-request/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateSession } from "../shared/validateSession.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

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
    const auth = req.headers.get("authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false, 
          message: "Unauthorized"
        },
      corsHeaders,
      401
      );
    }

    const { item_id, message } = await req.json();

    // Billing: requester pays to initiate a transfer request (if task cost is > 0)
    const { data: requesterRow } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", session.user_id)
      .maybeSingle();
    const role = String((requesterRow as any)?.role || "").toLowerCase();
    const isPrivileged = role === "admin" || role === "cashier";
    if (!isPrivileged) {
      const { data: spendRes, error: spendErr } = await supabase.rpc("spend_credits", {
        p_user_id: String(session.user_id),
        p_task_code: "REQUEST_TRANSFER",
        p_reference: String(item_id || ""),
        p_metadata: { kind: "create-transfer-request" },
      });
      const ok = Array.isArray(spendRes) ? spendRes[0]?.success : spendRes?.success;
      const msg = Array.isArray(spendRes) ? spendRes[0]?.message : spendRes?.message;
      if (spendErr || !ok) {
        return respond(
          {
            success: false,
            message: msg || "Insufficient credits",
            billing: { required: true, task_code: "REQUEST_TRANSFER" },
          },
          corsHeaders,
          402,
        );
      }
    }

    const { error } = await supabase.rpc("request_item_transfer", {
      p_item_id: item_id,
      p_requester_id: session.user_id,
      p_message: message ?? null,
    });

    if (error) {
      return respond(
        { 
          success: false,
          message: error.message
        },
      corsHeaders,
      400
      );
    }

    return respond(
      {
        success: true
      },
      corsHeaders,
      200
    );

  } catch (err) {
    return respond(
      {
        success: false,
        message: "Unexpected error"
      }, 
    corsHeaders,
    500
    );
  }
});