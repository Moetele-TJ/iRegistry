import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { logActivity } from "../shared/logActivity.ts";

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

    const actorUserId = String(session.user_id);
    const actorRole = String(session.role || "");

    const body = await req.json().catch(() => null);
    const id = body?.id;
    if (!id || typeof id !== "string") {
      return respond({ success: false, message: "Missing item id" }, corsHeaders, 400);
    }

    const { data: item, error: fetchErr } = await supabase
      .from("items")
      .select("id, ownerid, name, deletedat, legacyat")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !item) {
      return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
    }

    if (item.deletedat) {
      return respond({ success: false, message: "Cannot restore a deleted item from legacy" }, corsHeaders, 409);
    }

    if (!item.legacyat) {
      return respond({ success: false, message: "Item is not in legacy" }, corsHeaders, 409);
    }

    const isOwner = String(item.ownerid) === actorUserId;
    const privileged = isPrivilegedRole(actorRole);
    if (!isOwner && !privileged) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const { error: upErr } = await supabase
      .from("items")
      .update({
        legacyat: null,
        legacy_reason: null,
        legacy_by: null,
      })
      .eq("id", id)
      .is("deletedat", null)
      .not("legacyat", "is", null);

    if (upErr) {
      return respond({ success: false, message: upErr.message || "Failed to restore item" }, corsHeaders, 500);
    }

    await logActivity(supabase, {
      actorId: actorUserId,
      actorRole,
      entityType: "item",
      entityId: id,
      entityName: item.name ?? null,
      action: "ITEM_LEGACY_RESTORE",
      message: `Restored "${item.name || "item"}" from legacy`,
      metadata: null,
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("restore-legacy-item crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

