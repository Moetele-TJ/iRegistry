// Active (non-returned) police case for an item — owner, matching-station police, or privileged.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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
        { success: false, message: "Unauthorized" },
        corsHeaders,
        401,
      );
    }

    const body = await req.json().catch(() => ({}));
    const itemId = body?.itemId;

    if (!itemId || typeof itemId !== "string") {
      return respond(
        { success: false, message: "Missing itemId" },
        corsHeaders,
        400,
      );
    }

    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, ownerid, slug")
      .eq("id", itemId)
      .is("deletedat", null)
      .maybeSingle();

    if (itemErr || !item) {
      return respond(
        { success: false, message: "Item not found" },
        corsHeaders,
        404,
      );
    }

    const { data: caseRow, error: caseErr } = await supabase
      .from("item_police_cases")
      .select("*")
      .eq("item_id", itemId)
      .neq("status", "ReturnedToOwner")
      .maybeSingle();

    if (caseErr) {
      return respond(
        { success: false, message: "Failed to load case" },
        corsHeaders,
        500,
      );
    }

    if (!caseRow) {
      return respond({ success: true, case: null }, corsHeaders, 200);
    }

    const uid = session.user_id;
    const role = session.role;

    if (item.ownerid === uid || isPrivilegedRole(role)) {
      return respond({ success: true, case: caseRow }, corsHeaders, 200);
    }

    if (roleIs(role, "police")) {
      const station = await getPoliceStation(supabase, uid);
      if (
        station &&
        String(caseRow.station).trim() === String(station).trim()
      ) {
        return respond({ success: true, case: caseRow }, corsHeaders, 200);
      }
    }

    return respond(
      { success: false, message: "Not allowed to view this case" },
      corsHeaders,
      403,
    );
  } catch (err: unknown) {
    console.error("get-item-police-case:", err);
    return respond(
      {
        success: false,
        message: err instanceof Error ? err.message : "Unexpected error",
      },
      corsHeaders,
      500,
    );
  }
});
