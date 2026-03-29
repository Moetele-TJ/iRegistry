// Advance item_police_cases for the signed-in officer's station (linear pipeline only).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";
import { logActivity } from "../shared/logActivity.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED: Record<string, string> = {
  Open: "InCustody",
  InCustody: "ClearedForReturn",
  ClearedForReturn: "ReturnedToOwner",
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") ||
      req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success: false, diag: "POLICE-CASE-401", message: "Unauthorized" },
        corsHeaders,
        401,
      );
    }

    if (session.role !== "police") {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-403",
          message: "Only police accounts can update station cases.",
        },
        corsHeaders,
        403,
      );
    }

    const body = await req.json().catch(() => null);
    const caseId = body?.caseId;
    const nextStatus = body?.nextStatus;

    if (!caseId || typeof caseId !== "string") {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-001",
          message: "Missing case id",
        },
        corsHeaders,
        400,
      );
    }

    if (!nextStatus || typeof nextStatus !== "string") {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-002",
          message: "Missing nextStatus",
        },
        corsHeaders,
        400,
      );
    }

    const officerStation = await getPoliceStation(supabase, session.user_id);
    if (!officerStation?.trim()) {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-003",
          message: "No police station on your profile.",
        },
        corsHeaders,
        403,
      );
    }

    const { data: row, error: fetchErr } = await supabase
      .from("item_police_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();

    if (fetchErr || !row) {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-004",
          message: "Case not found",
        },
        corsHeaders,
        404,
      );
    }

    if (String(row.station).trim() !== String(officerStation).trim()) {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-005",
          message: "This case is not assigned to your station.",
        },
        corsHeaders,
        403,
      );
    }

    const expectedNext = ALLOWED[row.status];
    if (!expectedNext || expectedNext !== nextStatus) {
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-006",
          message:
            `Invalid transition from ${row.status}. Expected next: ${expectedNext ?? "none"}.`,
        },
        corsHeaders,
        400,
      );
    }

    const patch: Record<string, unknown> = {
      status: nextStatus,
      updated_by: session.user_id,
    };

    if (nextStatus === "ClearedForReturn") {
      patch.cleared_at = new Date().toISOString();
    }

    if (nextStatus === "ReturnedToOwner") {
      patch.returned_at = new Date().toISOString();
    }

    const { data: updatedCase, error: caseErr } = await supabase
      .from("item_police_cases")
      .update(patch)
      .eq("id", caseId)
      .select("*")
      .single();

    if (caseErr || !updatedCase) {
      console.error("update-police-case:", caseErr);
      return respond(
        {
          success: false,
          diag: "POLICE-CASE-007",
          message: "Failed to update case",
        },
        corsHeaders,
        500,
      );
    }

    if (nextStatus === "ReturnedToOwner") {
      const { data: itemRow, error: itemFetchErr } = await supabase
        .from("items")
        .select("id, name, ownerid")
        .eq("id", row.item_id)
        .maybeSingle();

      if (itemFetchErr || !itemRow) {
        await supabase
          .from("item_police_cases")
          .update({
            status: row.status,
            returned_at: row.returned_at,
            cleared_at: row.cleared_at,
            updated_by: row.updated_by,
          })
          .eq("id", caseId);

        return respond(
          {
            success: false,
            diag: "POLICE-CASE-008",
            message: "Item not found; case update reverted.",
          },
          corsHeaders,
          500,
        );
      }

      const { data: updatedItem, error: itemErr } = await supabase
        .from("items")
        .update({
          status: "Active",
          reportedstolenat: null,
        })
        .eq("id", row.item_id)
        .select("*")
        .single();

      if (itemErr || !updatedItem) {
        await supabase
          .from("item_police_cases")
          .update({
            status: row.status,
            returned_at: row.returned_at,
            cleared_at: row.cleared_at,
            updated_by: row.updated_by,
          })
          .eq("id", caseId);

        return respond(
          {
            success: false,
            diag: "POLICE-CASE-009",
            message: "Failed to mark item active; case update reverted.",
          },
          corsHeaders,
          500,
        );
      }

      await supabase
        .from("image_embeddings")
        .update({ is_stolen: false })
        .eq("item_id", row.item_id);

      await logActivity(supabase, {
        actorId: session.user_id,
        actorRole: session.role,
        entityType: "item",
        entityId: row.item_id,
        entityName: updatedItem.name,
        action: "ITEM_MARKED_ACTIVE",
        message: `${updatedItem.name} returned to owner (police case closed).`,
        metadata: { police_case_id: caseId, via: "police_case" },
      });
    } else if (nextStatus === "InCustody" || nextStatus === "ClearedForReturn") {
      const logAction = nextStatus === "InCustody"
        ? "POLICE_CASE_IN_CUSTODY"
        : "POLICE_CASE_CLEARED_FOR_RETURN";
      const logMessage = nextStatus === "InCustody"
        ? "Police case: marked in custody"
        : "Police case: cleared for return";

      await logActivity(supabase, {
        actorId: session.user_id,
        actorRole: session.role,
        entityType: "item",
        entityId: row.item_id,
        entityName: null,
        action: logAction,
        message: logMessage,
        metadata: {
          police_case_id: caseId,
          from_status: row.status,
          to_status: nextStatus,
        },
      });
    }

    return respond(
      {
        success: true,
        case: updatedCase,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("update-police-case crash:", err);
    return respond(
      {
        success: false,
        diag: "POLICE-CASE-500",
        message: err instanceof Error ? err.message : "Unexpected error",
      },
      corsHeaders,
      500,
    );
  }
});
