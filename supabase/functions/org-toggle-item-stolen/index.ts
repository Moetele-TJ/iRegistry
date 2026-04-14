import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { canOrgResolveStolen, getActiveOrgMembership, isOrgPrivileged } from "../shared/orgAuth.ts";
import { logOrgItemActivity } from "../shared/logOrgItemActivity.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Action = "MARK_STOLEN" | "MARK_ACTIVE";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    if (req.method !== "POST") {
      return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
    }

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id : "";
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const action = typeof body?.action === "string" ? body.action.trim().toUpperCase() as Action : "";
    const policeStation = typeof body?.policeStation === "string" ? body.policeStation.trim() : "";

    if (!orgId) return respond({ success: false, message: "org_id is required" }, corsHeaders, 400);
    if (!itemId) return respond({ success: false, message: "item_id is required" }, corsHeaders, 400);
    if (!["MARK_STOLEN", "MARK_ACTIVE"].includes(action)) {
      return respond({ success: false, message: "Invalid action" }, corsHeaders, 400);
    }

    const membership = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
    if (!membership) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);

    const privileged = isOrgPrivileged(membership.role);

    const { data: item, error: fetchErr } = await supabase
      .from("items")
      .select("id, name, owner_org_id, assigned_user_id, deletedat, legacyat, reportedstolenat, station, location")
      .eq("id", itemId)
      .eq("owner_org_id", orgId)
      .maybeSingle();

    if (fetchErr || !item) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    if (item.deletedat) return respond({ success: false, message: "Item is deleted" }, corsHeaders, 409);
    if (item.legacyat) return respond({ success: false, message: "Item is legacy" }, corsHeaders, 409);

    const assignedToMe = String(item.assigned_user_id || "") === String(session.user_id);

    if (!privileged) {
      // Members: can only declare stolen on items assigned to them.
      if (!assignedToMe) {
        return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
      }
      if (action !== "MARK_STOLEN") {
        return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
      }
    }

    if (action === "MARK_ACTIVE" && !canOrgResolveStolen(membership.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const existingStolen = item.reportedstolenat !== null;
    const nextStolen = action === "MARK_STOLEN";
    if (existingStolen === nextStolen) {
      return respond({ success: true, message: "No change" }, corsHeaders, 200);
    }

    // Police case gating copied from update-item behavior.
    if (action === "MARK_STOLEN") {
      // Bill org wallet for MARK_STOLEN (if configured).
      const { data: spendRows, error: debitErr } = await supabase.rpc("spend_org_credits", {
        p_org_id: orgId,
        p_task_code: "MARK_STOLEN",
        p_reference: itemId,
        p_metadata: { kind: "org-toggle-item-stolen" },
        p_created_by: session.user_id,
      });
      if (debitErr) {
        return respond(
          {
            success: false,
            message: debitErr.message?.includes("INSUFFICIENT_CREDITS")
              ? "Insufficient credits"
              : "Billing failed",
          },
          corsHeaders,
          debitErr.message?.includes("INSUFFICIENT_CREDITS") ? 402 : 500,
        );
      }
      const spendOk = Array.isArray(spendRows) ? spendRows[0]?.success : null;
      if (spendOk !== true) {
        return respond({ success: false, message: "Insufficient credits" }, corsHeaders, 402);
      }

      const { data: openCase } = await supabase
        .from("item_police_cases")
        .select("id")
        .eq("item_id", itemId)
        .neq("status", "ReturnedToOwner")
        .maybeSingle();

      if (openCase) {
        return respond(
          {
            success: false,
            message:
              "This item already has an active police case. It must be returned to the owner (closed) before a new theft can be reported.",
          },
          corsHeaders,
          409,
        );
      }
    }

    let custodyCase: { id: string; status: string } | null = null;
    if (action === "MARK_ACTIVE") {
      const { data: activeCase } = await supabase
        .from("item_police_cases")
        .select("id, status")
        .eq("item_id", itemId)
        .neq("status", "ReturnedToOwner")
        .maybeSingle();

      custodyCase = activeCase;
      if (activeCase && (activeCase.status === "InCustody" || activeCase.status === "ClearedForReturn")) {
        return respond(
          {
            success: false,
            message:
              "This item is in police custody or cleared for return. Contact the station to complete return; you cannot mark it active yet.",
          },
          corsHeaders,
          403,
        );
      }
    }

    const nowIso = new Date().toISOString();
    const reportedstolenat = action === "MARK_STOLEN" ? nowIso : null;

    const { data: updated, error: upErr } = await supabase
      .from("items")
      .update({ reportedstolenat })
      .eq("id", itemId)
      .eq("owner_org_id", orgId)
      .select("id, reportedstolenat")
      .single();

    if (upErr || !updated) {
      return respond({ success: false, message: upErr?.message || "Failed to update item" }, corsHeaders, 500);
    }

    // Sync embeddings flag
    await supabase
      .from("image_embeddings")
      .update({ is_stolen: action === "MARK_STOLEN" })
      .eq("item_id", itemId);

    // Police case rows
    if (action === "MARK_STOLEN") {
      const mirroredStation = String((item.station ?? item.location) ?? "").trim();
      const station = (policeStation || mirroredStation) || "Unknown";
      const station_source = policeStation ? "user_selected" : "mirrored_from_location";

      const { error: caseErr } = await supabase.from("item_police_cases").insert({
        item_id: itemId,
        station,
        station_source,
        status: "Open",
        created_by: session.user_id,
        updated_by: session.user_id,
      });

      if (caseErr) {
        // Roll back stolen flag if case insert fails.
        await supabase.from("items").update({ reportedstolenat: item.reportedstolenat }).eq("id", itemId);
        await supabase.from("image_embeddings").update({ is_stolen: item.reportedstolenat !== null }).eq("item_id", itemId);
        return respond(
          {
            success: false,
            message: caseErr.code === "23505"
              ? "A police case for this item is already open."
              : "Could not open police case for this report.",
          },
          corsHeaders,
          409,
        );
      }
    }

    if (action === "MARK_ACTIVE" && custodyCase?.status === "Open") {
      await supabase
        .from("item_police_cases")
        .update({
          status: "ReturnedToOwner",
          returned_at: nowIso,
          notes: "Organization marked item active while case was still open (recovered without police custody).",
          updated_by: session.user_id,
        })
        .eq("id", custodyCase.id);
    }

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: itemId,
      actor_user_id: session.user_id,
      action: action === "MARK_STOLEN" ? "ORG_ITEM_REPORTED_STOLEN" : "ORG_ITEM_MARKED_ACTIVE",
      metadata: {
        item_name: item.name || null,
        assigned_user_id: item.assigned_user_id || null,
        police_station: policeStation || null,
      },
    });

    return respond({ success: true, item: updated }, corsHeaders, 200);
  } catch (err: any) {
    console.error("org-toggle-item-stolen crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

