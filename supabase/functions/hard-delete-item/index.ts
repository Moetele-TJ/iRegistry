// supabase/functions/hard-delete-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logItemAudit } from "../shared/logItemAudit.ts";

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

    const auth = req.headers.get("authorization");
    if (!auth) {
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(auth.replace("Bearer ", ""));

    if (authError || !authData?.user) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-AUTH-001",
          message: "Invalid or expired token",
        },
        corsHeaders,
        401
      );
    }

    const actor = authData.user;

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, role")
      .eq("auth_user_id", actor.id)
      .single();

    if (userError || !userRow) {
      return respond(
        {
          success: false,
          diag: "AUTH-USER-NOT-FOUND",
          message: "User profile not found",
        },
        corsHeaders,
        403
      );
    }

    const actorUserId = userRow.id;
    const actorRole = userRow.role;

    /* ---------------- INPUT ---------------- */

    const { id } = await req.json();
    if (!id) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-001",
          message: "Missing item id",
        },
        corsHeaders,
        400
      );
    }

    /* ---------------- FETCH ITEM ---------------- */

    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("*")
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
      // Users may ONLY hard delete soft-deleted items
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

      // Must have replacement item with same serial
      const { data: replacement } = await supabase
        .from("items")
        .select("id")
        .eq("ownerid", actorUserId)
        .or(
          `serial1.eq.${item.serial1},serial2.eq.${item.serial2}`
        )
        .is("deletedat", null)
        .neq("id", id)
        .limit(1);

      if (!replacement || replacement.length === 0) {
        return respond(
          {
            success: false,
            diag: "ITEM-HARD-DELETE-004",
            message: "No replacement item found for this serial number",
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

    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return respond(
        {
          success: false,
          diag: "ITEM-HARD-DELETE-005",
          message: "Failed to permanently delete item",
        },
        corsHeaders,
        500
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