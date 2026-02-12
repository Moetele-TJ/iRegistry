// supabase/functions/transfer-item-ownership/index.ts
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
    /* ===================== AUTH ===================== */

    const auth = req.headers.get("authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "ITEM-TRANS-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const actorUserId = session.user_id;
    const actorRole = session.role;

    if (actorRole !== "admin") {
      return respond(
        {
          success: false,
          diag: "ITEM-TRANS-AUTH-002",
          message: "You do not have sufficient privileges to perform this task.",
        },
        corsHeaders,
        403
      );
    }

    /* ===================== INPUT ===================== */

    const body = await req.json();
    const { itemId, newOwnerId, evidence } = body ?? {};

    if (!itemId || !newOwnerId) {
      return respond(
        {
          success: false,
          diag: "ITEM-TRANS-001",
          message: "Important information is missing. Please check the information you provided.",
        },
        corsHeaders,
        400
      );
    }

    if (
      !evidence ||
      typeof evidence !== "object" ||
      !evidence.fileId ||
      !evidence.type ||
      !evidence.uploadedAt
    ) {
      return respond(
        {
          success: false,
          diag: "ITEM-TRANS-002",
          message: "Valid ownership transfer evidence is required",
        },
        corsHeaders,
        400
      );
    }

    /* ===================== CALL DB TRANSACTION ===================== */

    const { error: rpcError } = await supabase.rpc(
      "transfer_item_ownership",
      {
        p_item_id: itemId,
        p_new_owner_id: newOwnerId,
        p_actor_id: actorUserId,
        p_evidence: evidence,
      }
    );

    if (rpcError) {
      switch (rpcError.message) {
        case "ITEM_NOT_FOUND":
          return respond(
            {
              success: false,
              diag: "ITEM-TRANS-003",
              message: "We cannot find the specified item, please try again.",
            },
            corsHeaders,
            404
          );

        case "ITEM_IS_DELETED":
          return respond(
            {
              success: false,
              diag: "ITEM-TRANS-004",
              message: "We cannot transfer an already deleted item",
            },
            corsHeaders,
            409
          );

        case "NEW_OWNER_SAME_AS_CURRENT":
          return respond(
            {
              success: false,
              diag: "ITEM-TRANS-005",
              message: "New owner is already the current owner",
            },
            corsHeaders,
            409
          );

        default:
          console.error("transfer-item-ownership rpc error:", rpcError);
          return respond(
            {
              success: false,
              diag: "ITEM-TRANS-006",
              message: "Ownership transfer failed",
            },
            corsHeaders,
            500
          );
      }
    }

    /* ===================== RESPONSE ===================== */

    return respond(
      {
        success: true,
        transferred: true,
        toOwnerId: newOwnerId,
      },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("transfer-item-ownership crash:", err);

    return respond(
      {
        success: false,
        diag: "ITEM-TRANS-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});