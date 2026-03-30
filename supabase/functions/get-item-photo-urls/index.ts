// supabase/functions/get-item-photo-urls/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { getPoliceStation } from "../shared/getPoliceStation.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function normalizePhotoPath(raw: string) {
  let p = raw.trim();
  if (!p) return null;

  // If the client passed a full URL, try to strip to the bucket-relative path.
  // Expected: /storage/v1/object/public/item-photos/<path>
  const marker = "item-photos/";
  const idx = p.lastIndexOf(marker);
  if (idx !== -1) {
    p = p.slice(idx + marker.length);
  }

  p = p.replace(/^\/+/, "").replace(/^item-photos\//i, "");
  return p || null;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth =
      req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          diag: "ITEM-PHOTO-URL-AUTH-001",
          message: "Unauthorized",
        },
        corsHeaders,
        401
      );
    }

    const body = await req.json().catch(() => null);
    const { itemId, paths } = body ?? {};

    if (!itemId || typeof itemId !== "string" || !Array.isArray(paths)) {
      return respond(
        {
          success: false,
          diag: "ITEM-PHOTO-URL-REQ-001",
          message: "Invalid request",
        },
        corsHeaders,
        400
      );
    }

    // Basic access check: allow owner, privileged, or police with an open case.
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id, ownerid, deletedat, reportedstolenat")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr || !item || item.deletedat) {
      return respond(
        {
          success: false,
          diag: "ITEM-PHOTO-URL-ITEM-001",
          message: "Item not found",
        },
        corsHeaders,
        404
      );
    }

    const actorUserId = session.user_id;
    const actorRole = session.role;

    const canOwner = actorRole === "user" && item.ownerid === actorUserId;
    const canPrivileged = isPrivilegedRole(actorRole);

    let canPolice = false;
    if (actorRole === "police") {
      const station = await getPoliceStation(supabase, actorUserId);
      if (station) {
        const { data: caseRow } = await supabase
          .from("item_police_cases")
          .select("id")
          .eq("item_id", itemId)
          .neq("status", "ReturnedToOwner")
          .eq("station", String(station).trim())
          .maybeSingle();

        canPolice = !!caseRow;
      }
    }

    if (!canOwner && !canPrivileged && !canPolice) {
      return respond(
        {
          success: false,
          diag: "ITEM-PHOTO-URL-FORBID-001",
          message: "Not allowed to view photos",
        },
        corsHeaders,
        403
      );
    }

    const expiresSeconds = 60 * 10; // 10 minutes

    const cleanedPaths = paths
      .map((p: any) => (typeof p === "string" ? normalizePhotoPath(p) : null))
      .filter(Boolean) as string[];

    const urls: Array<string | null> = [];

    for (const p of paths) {
      if (typeof p !== "string") {
        urls.push(null);
        continue;
      }

      const normalized = normalizePhotoPath(p);
      if (!normalized) {
        urls.push(null);
        continue;
      }

      try {
        const { data: signed, error: signErr } = await supabase.storage
          .from("item-photos")
          .createSignedUrl(normalized, expiresSeconds);

        urls.push(signErr ? null : signed?.signedUrl ?? null);
      } catch {
        urls.push(null);
      }
    }

    return respond(
      { success: true, urls },
      corsHeaders,
      200
    );
  } catch (err) {
    console.error("get-item-photo-urls crash:", err);
    return respond(
      {
        success: false,
        diag: "ITEM-PHOTO-URL-500",
        message: "Unexpected server error",
      },
      corsHeaders,
      500
    );
  }
});

