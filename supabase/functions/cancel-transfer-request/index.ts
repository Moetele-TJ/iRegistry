//  supabase/functions/cancel-transfer-request/index.ts
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

    const { request_id } = await req.json();

    if (typeof request_id !== "string") {
      return respond(
        {
          success: false,
          message: "Invalid request payload"
        },
        corsHeaders,
        400
      );
    }

    const { error } = await supabase.rpc("cancel_item_transfer_request", {
      p_request_id: request_id,
      p_requester_id: session.user_id,
    });

    if (error) {
      switch (error.message) {
        case "REQUEST_NOT_FOUND":
          return respond(
            {
              success: false,
              message: "Request not found"
            },
            corsHeaders,
            404
          );

        case "REQUEST_NOT_PENDING":
          return respond(
            {
              success: false,
              message: "Request already reviewed"
            },
            corsHeaders,
            409
          );

        case "NOT_REQUEST_OWNER":
          return respond(
            {
              success: false,
              message: "You are not the requester"
            },
            corsHeaders,
            403
          );

        case "REQUEST_EXPIRED":
          return respond(
            {
              success: false,
              message: "Request has expired"
            },
            corsHeaders,
            410
          );

        case "ITEM_NOT_FOUND":
          return respond(
            {
              success: false,
              message: "Item not found"
            },
            corsHeaders,
            404
          );

        default:
          console.error("Unhandled RPC error:", error);
          return respond(
            {
              success: false,
              message: "Cancellation failed"
            },
            corsHeaders,
            500
          );
      }
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
        message: "Unexpected server error"
      },
      corsHeaders,
      500
    );
  }
});