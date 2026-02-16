// supabase/functions/hard-delete-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logItemAudit } from "../shared/logItemAudit.ts";
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
    /* ---------------- AUTH ---------------- */

    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const actorUserId = session.user_id;
    const actorRole = session.role;

    /* ---------------- INPUT ---------------- */

    const body = await req.json().catch(() => null);

      if (!body || typeof body.id !== "string") {
        return respond(
          {
            success: false,
            diag: "ITEM-HARD-DELETE-001",
            message: "Invalid request",
          },
          corsHeaders,
          400
        );
      }

      const { id } = body;

    /* ---------------- FETCH ITEM ---------------- */

    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("id, ownerid, deletedat, serial1, serial2")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !item) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-002",
          message: "Item not found",
        },
        corsHeaders,
        404
      );
    }

    const isOwner = item.ownerid === actorUserId;
    const isAdmin = actorRole === "admin";

    if (!isOwner && !isAdmin) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-AUTH-002",
          message: "Not allowed to hard delete this item",
        },
        corsHeaders,
        403
      );
    }

    /* ---------------- USER RULES ---------------- */

    let auditMetadata: Record<string, unknown> = {};

    if (!isAdmin) {
      if (!item.deletedat) {
        return respond(
          {
            success: false,
            diag: "ITEM-HARD-DELETE-003",
            message: "Active items cannot be permanently deleted",
          },
          corsHeaders,
          409
        );
      }

      if (!item.serial1 && !item.serial2) {
        return respond(
          {
            success: false,
            diag: "ITEM-HARD-DELETE-006",
            message: "Item has no serial numbers to validate replacement",
          },
          corsHeaders,
          409
        );
      }

      let replacementQuery = supabase
        .from("items")
        .select("id")
        .eq("ownerid", actorUserId)
        .is("deletedat", null)
        .neq("id", id);

      if (item.serial1 && item.serial2) {
        replacementQuery = replacementQuery.or(
          `serial1.eq.${item.serial1},serial2.eq.${item.serial2}`
        );
      } else if (item.serial1) {
        replacementQuery = replacementQuery.eq("serial1", item.serial1);
      } else if (item.serial2) {
        replacementQuery = replacementQuery.eq("serial2", item.serial2);
      }



      const { data: replacement, error: replacementError } =
        await replacementQuery.limit(1);

      if (replacementError || !replacement || replacement.length === 0) {
        return respond(
          {
            success: false,
            diag: "ITEM-HARD-DELETE-004",
            message: "You currently cannot delete this item.",
          },
          corsHeaders,
          409
        );
      }
      auditMetadata = {
        reason: "REPLACED_BY_NEW_ITEM",
        replacementItemId: replacement[0].id,
      };
    } else {
      auditMetadata = {
        reason: "ADMIN_ACTION",
      };
    }

    /* ---------------- HARD DELETE ---------------- */

    let deleteQuery = supabase
      .from("items")
      .delete()
      .eq("id", id);

    if (!isAdmin) {
      deleteQuery = deleteQuery.not("deletedat", "is", null);
    }

    const { error: deleteError, count } = await deleteQuery.select("id", { count: "exact" });

    if (deleteError || count === 0) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-005",
          message: "Failed to permanently delete item",
        },
        corsHeaders,
        409
      );
    }

    /* ---------------- AUDIT ---------------- */

    await logItemAudit({
      supabase,
      itemId: id,
      actorId: actorUserId,
      action: "ITEM_HARD_DELETED",
      details: {
        metadata: auditMetadata,
      },
    });

    /* ---------------- RESPONSE ---------------- */

    return respond(
      {
        success: true,
        permanentlyDeleted: true,
      },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("hard-delete-item crash:", err);

    return respond(
      {
        success: false,
        diag: "ITEM-HARD-DELETE-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});