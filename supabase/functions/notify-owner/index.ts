// supabase/functions/notify-owner/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeSerial } from "../shared/serial.ts";
import { respond } from "../shared/respond.ts";
import { getCorsHeaders } from "../shared/cors.ts";
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
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    const { serial, message: userMessage, contact, notifyPolice } = await req.json();

    if (!serial) {
      return respond(
        { success: false, message: "A Serial number is required, please enter it before you continue." },
        corsHeaders,
        400
      );
    }

    if (!userMessage?.trim()) {
      return respond(
        { success: false, message: "A message is required, please enter it before you continue." },
        corsHeaders,
        400
      );
    }

    if (!contact?.trim()) {
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
          `serial1_normalized.eq.${normalized},serial2_normalized.eq.${normalized}`
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

    // Free gate: allow 1 notify/day per (ip,item). After that, require auth + credits.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const actionKey = `notify_owner:${item.id}`;
    const { count: dayCount } = await supabase
      .from("request_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("action", actionKey)
      .gte("created_at", dayStart.toISOString());

    const freePerDay = 1;
    const overFree = (dayCount ?? 0) >= freePerDay;

    let session: { user_id: string } | null = null;
    let privileged = false;

    if (overFree) {
      const auth = req.headers.get("authorization") || req.headers.get("Authorization");
      session = await validateSession(supabase, auth);
      if (!session) {
        return respond(
          {
            success: false,
            message: "Free notification limit reached. Please login and use credits to continue.",
            billing: { required: true, task_code: "NOTIFY_OWNER" },
          },
          corsHeaders,
          402,
        );
      }

      const { data: spender } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", session.user_id)
        .maybeSingle();
      const role = String((spender as any)?.role || "").toLowerCase();
      privileged = role === "admin" || role === "cashier";
    }

    const applySpend = overFree && !privileged;

    const { error: deliverErr } = await supabase.rpc("notify_owner_deliver", {
      p_item_id: item.id,
      p_owner_id: item.ownerid,
      p_ip: ip,
      p_action_key: actionKey,
      p_message: userMessage,
      p_contact: contact,
      p_notify_police: notifyPolice === true,
      p_apply_spend: applySpend,
      p_spender_id: applySpend && session ? session.user_id : null,
    });

    if (deliverErr) {
      const em = String(deliverErr.message || "");
      if (em.includes("INSUFFICIENT_CREDITS")) {
        return respond(
          {
            success: false,
            message: "Insufficient credits",
            billing: { required: true, task_code: "NOTIFY_OWNER" },
          },
          corsHeaders,
          402,
        );
      }
      console.error("notify_owner_deliver:", deliverErr);
      throw deliverErr;
    }

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