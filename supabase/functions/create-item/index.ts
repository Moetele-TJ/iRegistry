// supabase/functions/create-item/index.ts
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
    /* ================= AUTH ================= */

    const auth = req.headers.get("authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const actorUserId = session.user_id;
    const actorRole = session.role;

    /* ================= INPUT ================= */

    const body = await req.json();

    const {
      ownerId,
      category,
      make,
      model,
      serial1,
      serial2,
      location,
      photos,
      purchaseDate,
      estimatedValue,
      shop,
      warrantyExpiry,
      notes,
    } = body ?? {};

    /* ================= OWNER RESOLUTION ================= */

    let resolvedOwnerId = ownerId ?? actorUserId;

    if (resolvedOwnerId && typeof resolvedOwnerId !== "string") {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-008",
          message: "Invalid owner ID",
        },
        corsHeaders,
        400
      );
    }

    const isPrivileged = isPrivilegedRole(actorRole);

    if (!isPrivileged && resolvedOwnerId !== actorUserId) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-AUTH-002",
          message: "You cannot create an item for another user",
        },
        corsHeaders,
        403
      );
    }

    /* ================= SERIAL VALIDATION ================= */

    if (!serial1) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-002",
          message: "Serial number is required.",
        },
        corsHeaders,
        400
      );
    }

    const serial1Normalized = normalizeSerial(serial1);

    if (!serial1Normalized) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-009",
          message: "Invalid serial number format.",
        },
        corsHeaders,
        400
      );
    }

    const { data: existingItem, error: duplicateError } = await supabase
      .from("items")
      .select("id")
      .eq("serial1_normalized", serial1Normalized)
      .is("deletedat", null)
      .maybeSingle();

    if (duplicateError) {
      return respond(
        {
          success: false,
          diag: "ITEM-DUPLICATE-ERROR",
          message: "Could not verify duplicate serial.",
        },
        corsHeaders,
        409
      );
    }

    if (existingItem) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-DUPLICATE",
          message: "An active item with this serial number already exists.",
        },
        corsHeaders,
        409
      );
    }

    /* ================= REQUIRED FIELDS ================= */

    if (!category || !make || !model) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-003",
          message: "Missing required fields.",
        },
        corsHeaders,
        400
      );
    }

    if (!location) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-005",
          message: "Location is required.",
        },
        corsHeaders,
        400
      );
    }

    if (photos && (!Array.isArray(photos) || photos.some(p => typeof p !== "string"))) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-007",
          message: "Invalid photo format.",
        },
        corsHeaders,
        400
      );
    }

    if (photos && photos.length > 5) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-006",
          message: "Maximum 5 photos allowed.",
        },
        corsHeaders,
        400
      );
    }

    /* ================= INSERT ================= */

    const name = `${make} ${model}`.trim();

    const { data, error } = await supabase
      .from("items")
      .insert({
        ownerid: resolvedOwnerId,
        name,
        category: category.trim(),
        make: make.trim(),
        model: model.trim(),
        serial1: serial1.trim(),
        serial1_normalized: serial1Normalized,
        location: location.trim(),
        photos,
        purchasedate: purchaseDate,
        estimatedvalue: estimatedValue,
        warrantyexpiry: warrantyExpiry,
        reportedstolenat: null,
        deletedat: null,
        status: "Active",
        serial2: typeof serial2 === "string" ? serial2.trim() || null : null,
        shop: typeof shop === "string" ? shop.trim() || null : null,
        notes: typeof notes === "string" ? notes.trim() || null : null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("ITEM INSERT ERROR:", error);
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-004",
          message: "Failed to save item",
        },
        corsHeaders,
        500
      );
    }

    await logItemAudit({
      supabase,
      itemId: data.id,
      actorId: actorUserId,
      action: "ITEM_CREATED",
      details: {
        metadata: {
          ownerId: resolvedOwnerId,
        },
      },
    });

    return respond(
      {
        success: true,
        item_id: data.id,
      },
      corsHeaders,
      201
    );

  } catch (err) {
    console.error("create-item crash:", err);

    return respond(
      {
        success: false,
        diag: "ITEM-CREATE-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});