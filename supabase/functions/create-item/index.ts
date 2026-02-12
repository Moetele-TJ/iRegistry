//supabase/functions/create-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logItemAudit } from "../shared/logItemAudit.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders });
  }

  try {
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

    /* ---------------- VALIDATION ---------------- */

    const auth = req.headers.get("authorization");
    if (!auth) {
      return respond({ 
        success:false, 
        message:"Unauthorized" 
        }, 
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
          diag: "ITEM-CREATE-AUTH-001",
          message: "You need to be logged in to perform this task.",
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

    // 3️⃣ These become your truth
    const actorUserId = userRow.id;
    const actorRole = userRow.role;

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

    // Admin override
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

    if (!serial1) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-002",
          message: "A serial number is missing for this item. please confirm and try again.",
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

    // 🔒 Prevent duplicates (ignore soft-deleted items)
    const { data: existingItem, error: duplicateError } = await supabase
      .from("items")
      .select("id")
      .eq("serial1_normalized", serial1Normalized)
      .is("deletedat", null)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      return respond(
        {
          success: false,
          diag: "ITEM-DUPLICATE-ERROR",
          message: "We are unable to check whether there is a duplicate serial number, so we can't continue.",
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

    if (!category || !make || !model) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-003",
          message: "This item is missing some key fields, please check the information.",
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
          message: "A location is missing for this item. Every item should have a jurisdiction.",
        },
        corsHeaders,
        400
      );
    }

    if (photos && (!Array.isArray(photos) || photos.some(p=>typeof p !=="string"))) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-007",
          message: "Make sure the files you provided are picture types",
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
          message: "You can only upload five(5) photos per item.",
        },
        corsHeaders,
        400
      );
    }

    /* ---------------- INSERT ---------------- */
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
        serial2: serial2.trim() || null,
        location: location.trim(),
        photos,
        purchasedate: purchaseDate,
        estimatedvalue: estimatedValue,
        shop: shop.trim() || null,
        warrantyexpiry: warrantyExpiry,
        reportedstolenat: null,
        deletedat: null,
        notes: notes.trim() || null,
        status: "Active",
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
    actorId: actorUserId,      // who performed the action
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