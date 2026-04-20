import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { roleIs } from "../shared/roles.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";
import { lookupActiveItemBySerialRaw } from "../shared/serialLookup.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!roleIs(session.role, "police")) {
      return respond({ success: false, message: "Only police accounts can perform this action." }, corsHeaders, 403);
    }
    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => ({}));
    const serialRaw = typeof body?.serial === "string" ? body.serial.trim() : "";
    if (!serialRaw) return respond({ success: false, message: "Serial is required." }, corsHeaders, 400);

    const serialNormalized = normalizeSerial(serialRaw);
    if (!serialNormalized) return respond({ success: false, message: "Invalid serial format." }, corsHeaders, 400);

    const station = String(await getPoliceStation(supabase, session.user_id) || "").trim();
    if (!station) {
      return respond({ success: false, message: "No police station on your profile." }, corsHeaders, 403);
    }

    const { item } = await lookupActiveItemBySerialRaw(supabase, serialNormalized, {
      select: "id, slug, name, make, model, serial1, serial2, station, location, ownerid",
      includeDeleted: false,
      includeLegacy: false,
    });

    return respond(
      {
        success: true,
        match: item
          ? {
              id: item.id,
              slug: item.slug,
              name: item.name,
              make: item.make,
              model: item.model,
              serial1: item.serial1,
              serial2: item.serial2,
              station: item.station || item.location || null,
              ownerid: item.ownerid,
            }
          : null,
        officer_station: station,
        serial_normalized: serialNormalized,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("police-lookup-serial crash:", err);
    const e = err as { message?: string };
    return respond({ success: false, message: e?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

