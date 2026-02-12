//📄 supabase/functions/update-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logItemAudit } from "../shared/logItemAudit.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
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

    const auth = req.headers.get("authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const actorUserId = session.user_id;
    const actorRole = session.role;

    /* ---------------- INPUT ---------------- */

    const body = await req.json();
    const { id, updates } = body ?? {};

    if (!id || !updates || typeof updates !== "object") {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-001",
          message: "Missing item id or updates",
        },
        corsHeaders,
        400
      );
    }

    /* ---------------- FETCH CURRENT ITEM ---------------- */

    const { data: existing, error: fetchError } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-002",
          message: "Item not found",
        },
        corsHeaders,
        404
      );
    }

    const isOwner = existing.ownerid === actorUserId;
    const isPrivileged = isPrivilegedRole(actorRole);

    if (!isOwner && !isPrivileged) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-AUTH-002",
          message: "You are not allowed to update this item",
        },
        corsHeaders,
        403
      );
    }

    if (existing.deletedat) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-005",
          message: "Cannot update a deleted item",
        },
        corsHeaders,
        409
      );
    }

    /* ---------------- SANITIZE UPDATES ---------------- */

    const fieldMap: Record<string, string> = {
      purchaseDate: "purchasedate",
      estimatedValue: "estimatedvalue",
      warrantyExpiry: "warrantyexpiry",
    };

    const reverseFieldMap = Object.fromEntries(
      Object.entries(fieldMap).map(([k, v]) => [v, k])
    );

    const allowed = [
      "category",
      "make",
      "model",
      "serial1",
      "serial2",
      "location",
      "photos",
      "purchaseDate",
      "estimatedValue",
      "shop",
      "warrantyExpiry",
      "notes",
    ];

    const cleanUpdates: Record<string, any> = {};

    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;

      const dbField = fieldMap[key] ?? key;
      const value = updates[key];

      cleanUpdates[dbField] =
        typeof value === "string" ? value.trim() : value;
    }

    if (Object.keys(cleanUpdates).length === 0) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-003",
          message: "No valid fields to update",
        },
        corsHeaders,
        400
      );
    }

    /* ---------------- SERIAL UPDATE CHECK ---------------- */

    if ("serial1" in cleanUpdates) {
      const newSerialNormalized = normalizeSerial(cleanUpdates.serial1);

      if (!newSerialNormalized) {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-006",
            message: "Invalid serial number format",
          },
          corsHeaders,
          400
        );
      }

      const { data: duplicate } = await supabase
        .from("items")
        .select("id")
        .eq("serial1_normalized", newSerialNormalized)
        .is("deletedat", null)
        .neq("id", id)
        .maybeSingle();

      if (duplicate) {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-DUPLICATE",
            message: "An active item with this serial number already exists.",
          },
          corsHeaders,
          409
        );
      }

      cleanUpdates["serial1_normalized"] = newSerialNormalized;
    }

    const requiredFields = ["category", "make", "model", "serial1", "location"];

    for (const field of requiredFields) {
      const dbField = fieldMap[field] ?? field;

      const newValue =
        dbField in cleanUpdates ? cleanUpdates[dbField] : existing[dbField];

      if (!newValue) {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-REQUIRED",
            message: `${field} cannot be empty`,
          },
          corsHeaders,
          400
        );
      }
    }

    const newMake = cleanUpdates.make ?? existing.make;
    const newModel = cleanUpdates.model ?? existing.model;

    cleanUpdates.name = `${newMake} ${newModel}`.trim();

    /* ---------------- DIFF ---------------- */

    const rawDiff = computeDiff(existing, cleanUpdates);
    const diff: Record<string, { from: any; to: any }> = {};

    for (const [dbKey, change] of Object.entries(rawDiff)) {
      const apiKey = reverseFieldMap[dbKey] ?? dbKey;
      diff[apiKey] = change;
    }

    if (Object.keys(diff).length === 0) {
      return respond(
        {
          success: true,
          message: "No changes detected",
        },
        corsHeaders,
        200
      );
    }

    /* ---------------- UPDATE ---------------- */

    const { error: updateError } = await supabase
      .from("items")
      .update(cleanUpdates)
      .eq("id", id);

    if (updateError) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-004",
          message: "Failed to update item",
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
      action: "ITEM_UPDATED",
      details: {
        changes: diff,
      },
    });

    return respond(
      {
        success: true,
        updated_fields: Object.keys(diff),
      },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("update-item crash:", err);

    return respond(
      {
        success: false,
        diag: "ITEM-UPDATE-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});

/* ---------------- HELPERS ---------------- */

function computeDiff(oldRow: any, updates: Record<string, any>) {
  const diff: Record<string, { from: any; to: any }> = {};

  for (const key of Object.keys(updates)) {
    if (oldRow[key] !== updates[key]) {
      diff[key] = {
        from: oldRow[key],
        to: updates[key],
      };
    }
  }

  return diff;
}