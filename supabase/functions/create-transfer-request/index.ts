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

    // Billing + insert are atomic in request_item_transfer (see migration 20260411120000_item_transfer_rpcs.sql).
    const { error } = await supabase.rpc("request_item_transfer", {
      p_item_id: item_id,
      p_requester_id: session.user_id,
      p_message: message ?? null,
    });

    if (error) {
      const em = String(error.message || "");
      if (em.includes("INSUFFICIENT_CREDITS")) {
        return respond(
          {
            success: false,
            message: "Insufficient credits",
            billing: { required: true, task_code: "REQUEST_TRANSFER" },
          },
          corsHeaders,
          402,
        );
      }
      const map: Record<string, string> = {
        ITEM_NOT_FOUND: "Item not found",
        ITEM_DELETED: "This item is no longer available",
        ITEM_STOLEN: "Stolen items cannot be transferred",
        ALREADY_OWNER: "You already own this item",
        PENDING_REQUEST_EXISTS: "A transfer request is already pending for this item",
        INVALID_PAYLOAD: "Invalid request",
      };
      for (const [code, text] of Object.entries(map)) {
        if (em.includes(code)) {
          return respond({ success: false, message: text }, corsHeaders, 400);
        }
      }
      return respond(
        {
          success: false,
          message: em || "Could not create transfer request",
        },
        corsHeaders,
        400,
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