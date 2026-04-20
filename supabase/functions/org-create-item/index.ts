import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { normalizeSerial } from "../shared/serial.ts";
import { slugify, generateUniqueSlug } from "../shared/slug.ts";
import { getActiveOrgMembership, canOrgEditItem } from "../shared/orgAuth.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { logOrgItemActivity } from "../shared/logOrgItemActivity.ts";

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

    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);

    const staff = isPrivilegedRole(session.role);
    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    const allowedByMembership = !!membership && canOrgEditItem(membership.role);
    if (!allowedByMembership && !staff) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const category = typeof body?.category === "string" ? body.category.trim() : "";
    const make = typeof body?.make === "string" ? body.make.trim() : "";
    const model = typeof body?.model === "string" ? body.model.trim() : "";
    const serial1 = typeof body?.serial1 === "string" ? body.serial1.trim() : "";
    const serial2 = typeof body?.serial2 === "string" ? body.serial2.trim() : "";
    const station = typeof body?.station === "string" ? body.station.trim() : "";
    const village = typeof body?.village === "string" ? body.village.trim() : "";
    const ward = typeof body?.ward === "string" ? body.ward.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    const assignToUserId = typeof body?.assign_to_user_id === "string" ? body.assign_to_user_id.trim() : "";

    if (!category || !make || !model || !serial1 || !station) {
      return respond({ success: false, message: "Missing required fields" }, corsHeaders, 400);
    }

    const serial1Normalized = normalizeSerial(serial1);
    const serial2Normalized = serial2 ? normalizeSerial(serial2) : null;
    if (!serial1Normalized) {
      return respond({ success: false, message: "Invalid primary serial number format" }, corsHeaders, 400);
    }
    if (serial2 && !serial2Normalized) {
      return respond({ success: false, message: "Invalid secondary serial number format" }, corsHeaders, 400);
    }

    // Duplicate serial guard against any active item (personal or org-owned).
    const { data: duplicate, error: duplicateError } = await supabase
      .from("items")
      .select("id")
      .is("deletedat", null)
      .or(
        [
          `serial1_normalized.eq.${serial1Normalized}`,
          `serial2_normalized.eq.${serial1Normalized}`,
          serial2Normalized ? `serial1_normalized.eq.${serial2Normalized}` : null,
          serial2Normalized ? `serial2_normalized.eq.${serial2Normalized}` : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      return respond({ success: false, message: "Could not verify duplicate serial" }, corsHeaders, 500);
    }
    if (duplicate) {
      return respond({ success: false, message: "An active item with this serial number already exists" }, corsHeaders, 409);
    }

    // Bill org wallet for ADD_ITEM.
    const { data: spendRows, error: spendErr } = await supabase.rpc("spend_org_credits", {
      p_org_id: orgId,
      p_task_code: "ADD_ITEM",
      p_reference: serial1,
      p_metadata: { kind: "org-create-item" },
      p_created_by: session.user_id,
    });
    if (spendErr) {
      const em = String(spendErr.message || "");
      return respond(
        { success: false, message: em.includes("INSUFFICIENT_CREDITS") ? "Insufficient credits" : "Billing failed" },
        corsHeaders,
        em.includes("INSUFFICIENT_CREDITS") ? 402 : 500,
      );
    }
    const ok = Array.isArray(spendRows) ? spendRows[0]?.success : null;
    if (ok !== true) {
      return respond({ success: false, message: "Insufficient credits", billing: { required: true, task_code: "ADD_ITEM" } }, corsHeaders, 402);
    }

    const baseSlug = slugify(`${serial1}-${make}-${model}`);
    const slug = await generateUniqueSlug({ supabase, baseSlug });
    const name = `${make} ${model}`.trim();

    const nowIso = new Date().toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from("items")
      .insert({
        ownerid: session.user_id, // creator (personal ownership is via owner_org_id)
        created_by: session.user_id,
        owner_org_id: orgId,
        assigned_user_id: assignToUserId || null,
        org_assigned_at: assignToUserId ? nowIso : null,
        org_assigned_by: session.user_id,
        name,
        category,
        make,
        model,
        serial1,
        serial1_normalized: serial1Normalized,
        serial2: serial2 || null,
        serial2_normalized: serial2Normalized,
        slug,
        village: village || null,
        ward: ward || null,
        station,
        location: station, // legacy mirror
        notes: notes || null,
        reportedstolenat: null,
        deletedat: null,
      })
      .select("id, name, owner_org_id, assigned_user_id, createdon")
      .single();

    if (insErr || !inserted) {
      console.error("org-create-item insert:", insErr?.message);
      return respond({ success: false, message: insErr?.message || "Failed to create item" }, corsHeaders, 500);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: inserted.id,
      actor_user_id: session.user_id,
      action: "ORG_ITEM_CREATED",
      metadata: {
        item_id: inserted.id,
        serial1,
        assigned_user_id: assignToUserId || null,
        billed_task: "ADD_ITEM",
      },
    });

    return respond({ success: true, item: inserted }, corsHeaders, 200);
  } catch (err: any) {
    console.error("org-create-item crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

