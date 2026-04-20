import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { roleIs } from "../shared/roles.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";
import { logActivity } from "../shared/logActivity.ts";
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
      return respond({ success: false, message: "Only police accounts can impound items." }, corsHeaders, 403);
    }
    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => ({}));
    const serialRaw = typeof body?.serial === "string" ? body.serial.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!serialRaw) return respond({ success: false, message: "Serial is required." }, corsHeaders, 400);

    const serialNormalized = normalizeSerial(serialRaw);
    if (!serialNormalized) return respond({ success: false, message: "Invalid serial format." }, corsHeaders, 400);

    const station = String(await getPoliceStation(supabase, session.user_id) || "").trim();
    if (!station) {
      return respond({ success: false, message: "No police station on your profile." }, corsHeaders, 403);
    }

    // 1) Try to match an existing active item by normalized serial(s)
    const { item } = await lookupActiveItemBySerialRaw(supabase, serialNormalized, {
      select: "id, ownerid, slug, name, make, model, serial1, serial2, station, location, reportedstolenat",
      includeDeleted: false,
      includeLegacy: false,
    });

    // Always write a found report for audit/history.
    const { data: report, error: repErr } = await supabase
      .from("found_item_reports")
      .insert({
        serial_normalized: serialNormalized,
        serial_raw: serialRaw,
        station,
        officer_user_id: session.user_id,
        notes: notes || null,
        status: item ? "MATCHED" : "OPEN",
        matched_item_id: item?.id ?? null,
        matched_owner_id: item?.ownerid ?? null,
        matched_at: item ? new Date().toISOString() : null,
      })
      .select("id, status, created_at, station, serial_normalized")
      .single();
    if (repErr || !report) throw repErr || new Error("Failed to create report");

    if (!item) {
      await logActivity(supabase, {
        actorId: session.user_id,
        actorRole: "police",
        entityType: "found_item_report",
        entityId: report.id,
        action: "impound_recorded",
        message: `Impounded item recorded at ${station} (no match yet)`,
        metadata: { serial: serialNormalized, station },
      });
      return respond(
        {
          success: true,
          result: { state: "NOT_FOUND", report },
        },
        corsHeaders,
        200,
      );
    }

    // 2) Match found: open/ensure police case at this station for the item
    await supabase
      .from("item_police_cases")
      .insert({
        item_id: item.id,
        station,
        station_source: "user_selected",
        status: "Open",
        created_by: session.user_id,
        updated_by: session.user_id,
        notes: notes ? `[${new Date().toISOString()}] Impounded match: ${notes}` : null,
      })
      .select("id")
      .maybeSingle()
      .catch(() => null); // if unique index blocks, case already exists

    // 3) Notify owner (stored in item_notifications for the owner)
    const itemMake = String((item as any)?.make || "").trim();
    const itemModel = String((item as any)?.model || "").trim();
    const label =
      [itemMake, itemModel].filter(Boolean).join(" ") ||
      String((item as any)?.name || "").trim() ||
      "your item";
    const serialShown = serialRaw;
    const msg = [
      "POLICE FOUND ITEM — ACTION REQUIRED",
      "",
      `A police officer has recorded a found / impounded item at: ${station}`,
      "",
      `Item: ${label}`,
      `Serial: ${serialShown}`,
      "",
      "What this means:",
      "- Police recovery channels will be followed.",
      "- This message is NOT a confirmation of ownership.",
      "- You must still provide the necessary proof of ownership to the police station.",
      "",
      "Next steps:",
      `1) Contact ${station} as soon as possible with your proof of ownership.`,
      "2) Bring any receipts, photos, original packaging, or other documentation that links you to the item.",
      "3) The station will advise you on the recovery process and timelines.",
    ].join("\n");
    await supabase.from("item_notifications").insert({
      itemid: item.id,
      ownerid: item.ownerid,
      message: msg,
      contact: station,
      recipient_type: "owner",
    });

    await logActivity(supabase, {
      actorId: session.user_id,
      actorRole: "police",
      entityType: "item",
      entityId: item.id,
      action: "impound_match",
      message: `Impounded item serial matched registry item; owner notified (${station})`,
      metadata: { serial: serialNormalized, station, report_id: report.id },
    });

    return respond(
      {
        success: true,
        result: {
          state: "FOUND",
          item: {
            id: item.id,
            slug: item.slug,
            name: item.name,
            make: (item as any)?.make ?? null,
            model: (item as any)?.model ?? null,
            serial: serialRaw,
            ownerid: item.ownerid,
          },
          report,
        },
      },
      corsHeaders,
      200,
    );
  } catch (err: any) {
    console.error("police-impound-item crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

