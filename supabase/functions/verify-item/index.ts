// supabase/functions/verify-item/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { logActivity } from "../shared/logActivity.ts";
import { checkRateLimit, recordAttempt } from "../shared/rateLimit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getGeoInfo(ip: string) {
  try {
    if (!ip || ip === "unknown") {
      return { country: "unknown", city: "unknown" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,city`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      return { country: "unknown", city: "unknown" };
    }

    const data = await res.json();

    return {
      country: data.country || "unknown",
      city: data.city || "unknown",
    };
  } catch {
    return { country: "unknown", city: "unknown" };
  }
}

const STOLEN_ALERT_COOLDOWN_MINUTES = 10;
const VERIFY_RATE_LIMIT = 20;
const VERIFY_WINDOW_SECONDS = 60;

async function shouldNotifyOwner(supabase: any, itemId: string, ownerId: string) {
  const since = new Date(
    Date.now() - STOLEN_ALERT_COOLDOWN_MINUTES * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("item_notifications")
    .select("id")
    .eq("itemid", itemId)
    .eq("ownerid", ownerId)
    .eq("recipient_type", "owner")
    .gte("createdon", since)
    .limit(1);

  return !data || data.length === 0;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  
  // ========================================
  // Verification intelligence
  // ========================================
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  await recordAttempt(supabase, {
    ip,
    action: "verify",
  });

  const allowed = await checkRateLimit(supabase, {
    ip,
    action: "verify",
    limit: VERIFY_RATE_LIMIT,
    windowSeconds: VERIFY_WINDOW_SECONDS,
  });

  if (!allowed) {
    return respond(
      {
        success: false,
        message: "Too many verification requests. Please try again later.",
      },
      corsHeaders,
      429
    );
  }

  const userAgent =
    req.headers.get("user-agent") || "unknown";

  const device =
    userAgent.includes("Tablet")
      ? "tablet"
      : userAgent.includes("Mobile")
      ? "mobile"
      : "desktop";

  try {
    const body = await req.json().catch(() => ({}));
    const { serial } = body;

    if (!serial || typeof serial !== "string") {
      return respond(
        { success: false, message: "Serial is required" },
        corsHeaders,
        400
      );
    }

    const cleaned = normalizeSerial(serial);

    const { data: item, error } = await supabase
      .from("items")
      .select("id, status, ownerid")
      .or(
        `serial1_normalized.eq.${cleaned},serial2_normalized.eq.${cleaned}`
      )
      .is("deletedat", null)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!item) {
      return respond(
        {
          success: true,
          result: { state: "NOT_FOUND" },
        },
        corsHeaders,
        200
      );
    }

    if (item.status === "Stolen") {

      const geo = await getGeoInfo(ip);

      // 1️⃣ Log activity
      await logActivity(supabase, {
        actorId: "system",
        actorRole: "public",
        entityType: "item",
        entityId: item.id,
        action: "verify",
        message: `Stolen item serial verified from ${geo.city}, ${geo.country}`,
        metadata: {
          serial: cleaned,
          ip,
          country: geo.country,
          city: geo.city,
          device,
          userAgent,
          verified_at: new Date().toISOString()
        }
      });

      // 2️⃣ Notify owner
      const notify = await shouldNotifyOwner(supabase, item.id, item.ownerid);

      if (notify) {
        await supabase
          .from("item_notifications")
          .insert({
            itemid: item.id,
            ownerid: item.ownerid,
            message: "Someone verified the serial number of your stolen item.",
            contact: null,
            recipient_type: "owner"
          }
        );
      }

      return respond(
        {
          success: true,
          result: { 
            state: "STOLEN",
            itemId: item.id
          },
        },
        corsHeaders,
        200
      );
    }

    return respond(
      {
        success: true,
        result: { 
          state: "REGISTERED",
          itemId: item.id
        },
      },
      corsHeaders,
      200
    );

  } catch (err) {
    console.error("verify-item crash:", err);

    return respond(
      {
        success: false,
        message: "Verification failed",
      },
      corsHeaders,
      500
    );
  }
});