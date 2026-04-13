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
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;

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
      return respond({ success: false, message: "Cannot legacy a deleted item" }, corsHeaders, 409);
    }

    if (item.legacyat) {
      return respond({ success: false, message: "Item is already in legacy" }, corsHeaders, 409);
    }

    const isOwner = String(item.ownerid) === actorUserId;
    const privileged = isPrivilegedRole(actorRole);
    if (!isOwner && !privileged) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("items")
      .update({
        legacyat: now,
        legacy_reason: reason,
        legacy_by: actorUserId,
      })
      .eq("id", id)
      .is("deletedat", null)
      .is("legacyat", null);

    if (upErr) {
      return respond({ success: false, message: upErr.message || "Failed to move item to legacy" }, corsHeaders, 500);
    }

    await logActivity(supabase, {
      actorId: actorUserId,
      actorRole,
      entityType: "item",
      entityId: id,
      entityName: item.name ?? null,
      action: "ITEM_LEGACY",
      message: `Moved "${item.name || "item"}" to legacy`,
      metadata: { reason },
    });

    return respond({ success: true }, corsHeaders, 200);
  } catch (err: any) {
    console.error("mark-item-legacy crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

