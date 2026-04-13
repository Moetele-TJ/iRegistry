//📄 supabase/functions/update-item/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { logActivity } from "../shared/logActivity.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { validateSession } from "../shared/validateSession.ts";
import { slugify, generateUniqueSlug } from "../shared/slug.ts";

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

    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
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

    const body = await req.json().catch(() => null);

    if (!body) {
      return respond(
        { 
          success: false, 
          diag: "ITEM-UPDATE-000",
          message: "Invalid request"
        },
        corsHeaders,
        400
      );
    }

    const { id, updates, policeStation } = body ?? {};

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

    if (existing.legacyat) {
      return respond(
        {
          success: false,
          diag: "ITEM-UPDATE-LEGACY-001",
          message: "Cannot update a legacy item",
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
      // New location split
      "village",
      "ward",
      "station",
      // Legacy field (nearest station)
      "location",
      "photos",
      "purchaseDate",
      "estimatedValue",
      "shop",
      "warrantyExpiry",
      "notes",
      "status"
    ];

    let cleanUpdates: Record<string, any> = {};

    for (const key of Object.keys(updates)) {
      if (!allowed.includes(key)) continue;

      const dbField = fieldMap[key] ?? key;
      const value = updates[key];

      cleanUpdates[dbField] =
        typeof value === "string" ? value.trim() : value;
    }

    // Backwards-compatible mapping:
    // - If client updates legacy `location` but not `station`, treat it as station.
    // - If client updates `station` but not `location`, keep legacy `location` mirrored.
    if ("location" in cleanUpdates && !("station" in cleanUpdates)) {
      const loc = String(cleanUpdates.location ?? "").trim();
      if (loc) cleanUpdates.station = loc;
    }
    if ("station" in cleanUpdates && !("location" in cleanUpdates)) {
      const st = String(cleanUpdates.station ?? "").trim();
      if (st) cleanUpdates.location = st;
    }

    /* ---------------- DERIVED STATE (NO items.status) ----------------
     * We treat "stolen" as derived from `reportedstolenat`.
     * Back-compat: accept legacy `status` ("Active"/"Stolen") but translate it into `reportedstolenat`
     * and do not persist `status` to the DB anymore.
     */

    if ("status" in cleanUpdates) {
      const legacy = cleanUpdates.status;
      if (!["Active", "Stolen"].includes(legacy)) {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-STATUS-001",
            message: "Invalid status value",
          },
          corsHeaders,
          400
        );
      }

      // Translate legacy `status` to `reportedstolenat` intent.
      if (legacy === "Stolen") {
        if (existing.reportedstolenat == null && !("reportedstolenat" in cleanUpdates)) {
          cleanUpdates.reportedstolenat = new Date().toISOString();
        }
      }
      if (legacy === "Active") {
        cleanUpdates.reportedstolenat = null;
      }

      // Never persist status column going forward.
      delete cleanUpdates.status;
    }

    if ("reportedstolenat" in cleanUpdates) {
      const v = cleanUpdates.reportedstolenat;
      if (v === null) {
        // ok (becoming active)
      } else if (typeof v === "string") {
        const trimmed = v.trim();
        const parsed = Date.parse(trimmed);
        if (!trimmed || Number.isNaN(parsed)) {
          return respond(
            {
              success: false,
              diag: "ITEM-UPDATE-STOLENAT-001",
              message: "Invalid reportedStolenAt value",
            },
            corsHeaders,
            400
          );
        }
        cleanUpdates.reportedstolenat = new Date(parsed).toISOString();
      } else {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-STOLENAT-001",
            message: "Invalid reportedStolenAt value",
          },
          corsHeaders,
          400
        );
      }
    }

    /* Deep-compare (same as prune below): billing must not charge EDIT_ITEM for unchanged fields. */
    function stableStringify(v: any): string {
      if (v === null) return "null";
      if (v === undefined) return "undefined";
      const t = typeof v;
      if (t !== "object") return JSON.stringify(v);

      if (Array.isArray(v)) {
        return `[${v.map(stableStringify).join(",")}]`;
      }

      const keys = Object.keys(v).sort();
      return `{${keys
        .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
        .join(",")}}`;
    }

    function deepEqual(a: any, b: any): boolean {
      return stableStringify(a) === stableStringify(b);
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

    if (
      "serial1" in cleanUpdates &&
      cleanUpdates.serial1 !== existing.serial1
    ) {
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

    if ("estimatedvalue" in cleanUpdates) {
      const val = Number(cleanUpdates.estimatedvalue);
      if (isNaN(val)) {
        return respond(
          { success: false, message: "Estimated value must be numeric" },
          corsHeaders,
          400
        );
      }
      cleanUpdates.estimatedvalue = val;
    }

    // We keep `location` required for now because the DB column is NOT NULL.
    // New UI will treat `station` as the required field; we mirror it into `location`.
    const requiredFields = ["category", "make", "model", "serial1", "location"];

    for (const field of requiredFields) {
      const dbField = fieldMap[field] ?? field;

      const newValue =
        dbField in cleanUpdates ? cleanUpdates[dbField] : existing[dbField];

      if (newValue === null || newValue === undefined || newValue ==="") {
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

    if ("photos" in cleanUpdates) {
      const p = cleanUpdates.photos;

      if (p === null) {
        cleanUpdates.photos = null;
      } else if (!Array.isArray(p)) {
        return respond(
          { success: false, message: "Invalid photos" },
          corsHeaders,
          400,
        );
      } else if (p.length > 5) {
        return respond(
          { success: false, message: "Invalid photos" },
          corsHeaders,
          400,
        );
      } else if (p.length === 0) {
        cleanUpdates.photos = [];
      } else {
        const normalized: { original: string; thumb: string }[] = [];
        for (const x of p) {
          if (typeof x === "string") {
            const s = x.trim();
            if (!s) {
              return respond(
                { success: false, message: "Invalid photos" },
                corsHeaders,
                400,
              );
            }
            normalized.push({ original: s, thumb: s });
          } else if (
            x &&
            typeof x === "object" &&
            typeof (x as { original?: unknown }).original === "string" &&
            typeof (x as { thumb?: unknown }).thumb === "string"
          ) {
            const o = String((x as { original: string }).original).trim();
            const t = String((x as { thumb: string }).thumb).trim();
            if (!o || !t) {
              return respond(
                { success: false, message: "Invalid photos" },
                corsHeaders,
                400,
              );
            }
            normalized.push({ original: o, thumb: t });
          } else {
            return respond(
              { success: false, message: "Invalid photos" },
              corsHeaders,
              400,
            );
          }
        }
        cleanUpdates.photos = normalized;
      }
    }

    const newMake = cleanUpdates.make ?? existing.make;
    const newModel = cleanUpdates.model ?? existing.model;

    cleanUpdates.name = `${newMake} ${newModel}`.trim();

    /* ---------------- SLUG UPDATE CHECK ---------------- */

    if (
      ("serial1" in cleanUpdates && cleanUpdates.serial1 !== existing.serial1) ||
      ("make" in cleanUpdates && cleanUpdates.make !== existing.make) ||
      ("model" in cleanUpdates && cleanUpdates.model !== existing.model)
    ) {
      const newSerial = cleanUpdates.serial1 ?? existing.serial1;
      const newMake = cleanUpdates.make ?? existing.make;
      const newModel = cleanUpdates.model ?? existing.model;

      const baseSlug = slugify(`${newSerial}-${newMake}-${newModel}`);

      const newSlug = await generateUniqueSlug({
        supabase,
        baseSlug,
        excludeId: id,
      });

      cleanUpdates.slug = newSlug;
    }

    /* ---------------- PRUNE NO-OP FIELDS ----------------
     * The client may submit fields even when unchanged (e.g. always includes `status`).
     * To ensure we never write unchanged values (and to keep side effects/activity logs accurate),
     * remove any update keys whose value is deep-equal to the existing DB value.
     */

    const pruned: Record<string, any> = {};
    for (const [k, v] of Object.entries(cleanUpdates)) {
      if (typeof v === "undefined") continue;
      const existingVal = (existing as any)[k];
      if (!deepEqual(existingVal, v)) pruned[k] = v;
    }
    cleanUpdates = pruned;
    
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

    /* ---------------- POLICE CASE RULES (before update) ---------------- */
    /* Use pruned cleanUpdates so intent matches what we will persist */
    const existingStolen = existing.reportedstolenat !== null;
    const nextReportedStolenAt =
      "reportedstolenat" in cleanUpdates
        ? cleanUpdates.reportedstolenat
        : existing.reportedstolenat;
    const nextStolen = nextReportedStolenAt !== null;
    const stolenFlagChanged = existingStolen !== nextStolen;
    const becomingStolen = stolenFlagChanged && nextStolen;
    const becomingActive = stolenFlagChanged && !nextStolen;

    if (becomingStolen) {
      const { data: openCase } = await supabase
        .from("item_police_cases")
        .select("id")
        .eq("item_id", id)
        .neq("status", "ReturnedToOwner")
        .maybeSingle();

      if (openCase) {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-CASE-001",
            message:
              "This item already has an active police case. It must be returned to the owner (closed) before a new theft can be reported.",
          },
          corsHeaders,
          409
        );
      }
    }

    let custodyCase: { id: string; status: string } | null = null;

    if (becomingActive) {
      const { data: activeCase } = await supabase
        .from("item_police_cases")
        .select("id, status")
        .eq("item_id", id)
        .neq("status", "ReturnedToOwner")
        .maybeSingle();

      custodyCase = activeCase;

      if (
        activeCase &&
        (activeCase.status === "InCustody" ||
          activeCase.status === "ClearedForReturn")
      ) {
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-CASE-002",
            message:
              "This item is in police custody or cleared for return. Contact the station to complete return; you cannot mark it active on your own.",
          },
          corsHeaders,
          403
        );
      }
    }

    /* ---------------- BILLING (after validation & police gates; debit_item_update_tasks) ---------------- */
    const billToUserId = String(existing.ownerid);
    const { data: ownerRow } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", billToUserId)
      .maybeSingle();
    const ownerRole = (ownerRow as any)?.role;
    const ownerIsPrivileged = isPrivilegedRole(ownerRole);
    const actorIsPrivileged = isPrivilegedRole(actorRole);

    let needMarkStolen = false;
    let needUploadPhotos = false;
    let needEditItem = false;

    if (!actorIsPrivileged && !ownerIsPrivileged) {
      needMarkStolen = Boolean(becomingStolen);

      if ("photos" in cleanUpdates && Array.isArray(cleanUpdates.photos)) {
        const existingPhotos = Array.isArray(existing.photos) ? existing.photos : [];
        const existingSet = new Set(
          existingPhotos
            .map((p: any) => (typeof p === "string" ? p : p?.original || p?.thumb || ""))
            .map((s: any) => String(s || "").trim())
            .filter(Boolean),
        );
        const incoming = cleanUpdates.photos as any[];
        const hasNew = incoming.some((p) => {
          const raw = typeof p === "string" ? p : p?.original || p?.thumb || "";
          const key = String(raw || "").trim();
          return key && !existingSet.has(key);
        });
        if (hasNew) {
          needUploadPhotos = true;
        }
      }

      const keys = Object.keys(cleanUpdates);
      const meaningful = keys.filter((k) => !["reportedstolenat"].includes(k));
      const hasNonPhotoNonStatusChange = meaningful.some((k) => {
        if (k === "photos") return false;
        const existingVal = (existing as any)[k];
        const v = (cleanUpdates as any)[k];
        return !deepEqual(existingVal, v);
      });
      if (hasNonPhotoNonStatusChange) {
        needEditItem = true;
      }
    }

    if (!actorIsPrivileged && !ownerIsPrivileged &&
        (needMarkStolen || needUploadPhotos || needEditItem)) {
      const { error: debitErr } = await supabase.rpc("debit_item_update_tasks", {
        p_bill_to_user_id: billToUserId,
        p_item_id: id,
        p_mark_stolen: needMarkStolen,
        p_upload_photos: needUploadPhotos,
        p_edit_item: needEditItem,
      });
      if (debitErr) {
        const em = String(debitErr.message || "");
        const billingMap: [string, string][] = [
          ["INSUFFICIENT_MARK_STOLEN", "MARK_STOLEN"],
          ["INSUFFICIENT_UPLOAD_PHOTOS", "UPLOAD_PHOTOS"],
          ["INSUFFICIENT_EDIT_ITEM", "EDIT_ITEM"],
        ];
        for (const [needle, code] of billingMap) {
          if (em.includes(needle)) {
            return respond(
              {
                success: false,
                diag:
                  code === "MARK_STOLEN"
                    ? "ITEM-UPDATE-BILL-001"
                    : code === "UPLOAD_PHOTOS"
                    ? "ITEM-UPDATE-BILL-002"
                    : "ITEM-UPDATE-BILL-003",
                message: "Insufficient credits",
                billing: { required: true, task_code: code },
              },
              corsHeaders,
              402,
            );
          }
        }
        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-BILL-000",
            message: debitErr.message || "Billing failed",
          },
          corsHeaders,
          500,
        );
      }
    }

    /* ---------------- UPDATE ---------------- */

    const { data: updatedItem, error: updateError } = await supabase
      .from("items")
      .update(cleanUpdates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updatedItem) {
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

    /* ---------------- SYNC EMBEDDING STATUS ---------------- */

    if (stolenFlagChanged) {

      const isStolen = updatedItem.reportedstolenat !== null;

      await supabase
        .from("image_embeddings")
        .update({ is_stolen: isStolen })
        .eq("item_id", id);

    }

    /* ---------------- ACTIVITY LOG ---------------- */

    let action = "ITEM_UPDATED";
    let message = `Updated item ${updatedItem.name}`;

    if (stolenFlagChanged) {
      if (becomingStolen) {
        action = "ITEM_REPORTED_STOLEN";
        message = `${updatedItem.name} was reported stolen`;
      }

      if (becomingActive) {
        action = "ITEM_MARKED_ACTIVE";
        message = `${updatedItem.name} was marked active`;
      }

    }

    await logActivity(supabase, {
      actorId: actorUserId,
      actorRole,
      entityType: "item",
      entityId: id,
      entityName: updatedItem.name,
      action,
      message,
      metadata: {
        changes: diff,
      },
    });

    /* ---------------- POLICE CASE ROWS (after stolen / active) ---------------- */

    if (becomingStolen) {
      const ps =
        typeof policeStation === "string" ? policeStation.trim() : "";
      const mirroredStation = String((updatedItem.station ?? updatedItem.location) ?? "").trim();
      const station = (ps.length > 0 ? ps : mirroredStation) || "Unknown";
      const station_source = ps.length > 0
        ? "user_selected"
        : "mirrored_from_location";

      const { error: caseErr } = await supabase.from("item_police_cases").insert({
        item_id: id,
        station,
        station_source,
        status: "Open",
        created_by: actorUserId,
        updated_by: actorUserId,
      });

      if (caseErr) {
        console.error("item_police_cases insert:", caseErr);
        await supabase
          .from("items")
          .update({
            reportedstolenat: existing.reportedstolenat,
          })
          .eq("id", id);
        await supabase
          .from("image_embeddings")
          .update({ is_stolen: existing.reportedstolenat !== null })
          .eq("item_id", id);

        return respond(
          {
            success: false,
            diag: "ITEM-UPDATE-CASE-INSERT",
            message:
              caseErr.code === "23505"
                ? "A police case for this item is already open."
                : "Could not open police case for this report.",
          },
          corsHeaders,
          409
        );
      }
    }

    if (becomingActive && custodyCase?.status === "Open") {
      await supabase
        .from("item_police_cases")
        .update({
          status: "ReturnedToOwner",
          returned_at: new Date().toISOString(),
          notes: "Owner marked item active while case was still open (recovered without police custody).",
          updated_by: actorUserId,
        })
        .eq("id", custodyCase.id);
    }

    return respond(
      {
        success: true,
        item: updatedItem
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