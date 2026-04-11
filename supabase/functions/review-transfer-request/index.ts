// 📁 supabase/functions/review-transfer-request/index.ts

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

    const { request_id, decision } = await req.json();
    const normalizedDecision = decision?.toUpperCase();

    if (
      typeof request_id !== "string" ||
      !["APPROVED", "REJECTED"].includes(normalizedDecision)
    ) {
      return respond(
        {
          success: false,
          message: "Invalid request payload"
        },
        corsHeaders,
        400
      );
    }

    const { error } = await supabase.rpc("review_item_transfer", {
      p_request_id: request_id,
      p_owner_id: session.user_id,
      p_decision: normalizedDecision, // "APPROVED" | "REJECTED"
    });

    if (error) {
      const em = String(error.message || "");
      if (em.includes("INSUFFICIENT_CREDITS")) {
        return respond(
          {
            success: false,
            message: "Insufficient credits",
            billing: { required: true, task_code: "TRANSFER_OWNERSHIP" },
          },
          corsHeaders,
          402,
        );
      }
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
            { success: false,
              message: "Request already reviewed"
            },
            corsHeaders,
            409
          );

        case "NOT_ITEM_OWNER":
          return respond(
            {
              success: false,
              message: "You are not the owner of this item"
            },
            corsHeaders,
            403
          );

        case "REQUEST_EXPIRED":
          return respond(
            {
              success: false,
              message: "This request has expired"
            },
            corsHeaders,
            410
          );

        case "ITEM_DELETED":
          return respond(
            {
              success: false,
              message: "Item has been deleted"
            },
            corsHeaders,
            409
          );

        case "ITEM_STOLEN":
          return respond(
            {
              success: false,
              message: "Stolen items cannot be transferred"
            },
            corsHeaders,
            409
          );

        case "INVALID_DECISION":
          return respond(
            {
              success: false,
              message: "Invalid decision value"
            },
            corsHeaders,
            422
          );

        default:
          console.error("Unhandled RPC error:", error);
          return respond(
            {
              success: false,
              message: "Transfer operation failed"
            },
            corsHeaders,
            500
          );
      }
    }

    // TRANSFER_OWNERSHIP billing + ownership update run inside review_item_transfer (single transaction).

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