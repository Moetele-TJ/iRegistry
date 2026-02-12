//supabase/functions/restore-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logItemAudit } from "../shared/logItemAudit.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

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
      return respond(
        { success: false, message: "Unauthorized" },
        corsHeaders,
        401
      );
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(auth.replace("Bearer ", ""));

    if (authError || !authData?.user) {
      return respond(
        {
          success: false,
          diag: "ITEM-RESTORE-AUTH-001",
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

    const body = await req.json();
    const { id } = body ?? {};

    if (!id) {
      return respond(
        {
          success: false,
          diag: "ITEM-RESTORE-001",
          message: "Missing item id",
        },
        corsHeaders,
        400
      );
    }

    /* ---------------- FETCH ITEM ---------------- */

    const { data: existing, error: fetchError } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return respond(
        {
          success: false,
          diag: "ITEM-RESTORE-002",
          message: "Item not found",
        },
        corsHeaders,
        404
      );
    }

    /* ---------------- AUTHORIZE ---------------- */

    const isOwner = existing.ownerid === actorUserId;
    const isPrivileged = isPrivilegedRole(actorRole);

    if (!isOwner && !isPrivileged) {
      return respond(
        {
          success: false,
          diag: "ITEM-RESTORE-AUTH-002",
          message: "You do not have sufficient permissions to restore this item",
        },
        corsHeaders,
        403
      );
    }

    if (!existing.deletedat) {
      return respond(
        {
          success: false,
          diag: "ITEM-RESTORE-003",
          message: "This item is not deleted",
        },
        corsHeaders,
        409
      );
    }

    /* ---------------- RESTORE ---------------- */

    const { error: restoreError } = await supabase
      .from("items")
      .update({ deletedat: null })
      .eq("id", id);

    if (restoreError) {
      return respond(
        {
          success: false,
          diag: "ITEM-RESTORE-004",
          message: "Failed to restore item",
        },
        corsHeaders,
        500
      );
    }

    /* ---------------- AUDIT LOG ---------------- */

    await logItemAudit({
      supabase,
      itemId: id,
      actorId: actorUserId,
      action: "ITEM_RESTORED",
      details: {
        metadata: {
          restoredAt: new Date().toISOString(),
        },
      },
    });

    /* ---------------- RESPONSE ---------------- */

    return respond(
      {
        success: true,
        restored: true,
      },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("restore-item crash:", err);

    return respond(
      {
        success: false,
        diag: "ITEM-RESTORE-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});