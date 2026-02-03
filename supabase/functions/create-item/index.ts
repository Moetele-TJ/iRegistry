//supabase/functions/create-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logAudit } from "../shared/logAudit.ts";

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

    if (!ownerId) {
      return respond(
        {
          success: false,
          diag: "ITEM-CREATE-001",
          message: "This item has a missing owner ID. An item must belong to an individual",
        },
        corsHeaders,
        400
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
        ownerid: ownerId,
        name,
        category,
        make,
        model,
        serial1,
        serial2,
        location,
        photos,
        purchasedate: purchaseDate,
        estimatedvalue: estimatedValue,
        shop,
        warrantyexpiry: warrantyExpiry,
        reportedstolenat: null,
        deletedat: null,
        notes,
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

    await logAudit({
      supabase,
      event: "ITEM_CREATED",
      user_id: ownerId,
      success: true,
      diag: "ITEM-CREATE-OK",
      req,
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