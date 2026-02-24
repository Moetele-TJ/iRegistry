// supabase/functions/notify-owner/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSerial } from "../shared/serial.ts";
import { respond } from "../shared/respond.ts";
import { getCorsHeaders } from "../shared/cors.ts";

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
    const { serial, message: userMessage, contact, notifyPolice } = await req.json();

    if (!serial) {
      return respond(
        { success: false, message: "A Serial number is required, please enter it before you continue." },
        corsHeaders,
        400
      );
    }

    if (!userMessage.trim()) {
      return respond(
        { success: false, message: "A message is required, please enter it before you continue." },
        corsHeaders,
        400
      );
    }

    if (!contact.trim()) {
      return respond(
        { success: false, message: "A contact is required, please enter your phone number or emaill address." },
        corsHeaders,
        400
      );
    }

    const normalized = normalizeSerial(serial);

    const { data: item } = await supabase
      .from("items")
      .select("id, ownerid")
      .or(
        `serial1_normalized.eq.${normalized},
         serial2_normalized.eq.${normalized}`
      )
      .is("deletedat", null)
      .maybeSingle();

    if (!item) {
      return respond(
        { success: false, message: "Item not found" },
        corsHeaders,
        404
      );
    }

    // Always notify owner
    const inserts = [
      {
        itemid: item.id,
        ownerid: item.ownerid,
        recipient_type: "owner",
        message: userMessage,
        contact: contact ?? null,
      },
    ];

    // If police checkbox selected
    if (notifyPolice === true) {
      inserts.push({
        itemid: item.id,
        ownerid: item.ownerid,
        recipient_type: "police",
        message: userMessage,
        contact: contact ?? null,
      });
    }

    const { error: insertError } = await supabase
      .from("item_notifications")
      .insert(inserts);

    if (insertError) throw insertError;

    return respond(
      { success: true },
      corsHeaders,
      200
    );

  } catch (err) {
    return respond(
      { success: false, message: "Failed to notify owner" },
      corsHeaders,
      500
    );
  }
});