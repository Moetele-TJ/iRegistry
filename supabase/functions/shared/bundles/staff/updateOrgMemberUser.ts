import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../../cors.ts";
import { respond } from "../../respond.ts";
import { validateSession } from "../../validateSession.ts";
import { isPrivilegedRole } from "../../roles.ts";
import { logUserActivity } from "../../logUserActivity.ts";
import { logOrgItemActivity } from "../../logOrgItemActivity.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function displayName(u: any) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || String(u?.email || "").trim() || String(u?.id_number || "").trim() || "User";
}

export async function run(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    if (!isPrivilegedRole(session.role)) return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    if (req.method !== "POST") return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);

    const body = await req.json().catch(() => null);
    const orgId = typeof body?.org_id === "string" ? body.org_id.trim() : "";
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const updates = body?.updates && typeof body.updates === "object" ? body.updates : null;
    if (!orgId || !userId || !updates) return respond({ success: false, message: "Invalid request" }, corsHeaders, 400);

    // Ensure user is actually a member of this organization (any status besides REMOVED).
    const { data: mem, error: memErr } = await supabase
      .from("org_members")
      .select("user_id, org_id, status, role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr || !mem || mem.status === "REMOVED") {
      return respond({ success: false, message: "Member not found" }, corsHeaders, 404);
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("users")
      .select("id, first_name, last_name, id_number, phone, email, date_of_birth, village, ward, deleted_at")
      .eq("id", userId)
      .maybeSingle();
    if (fetchErr || !existing || existing.deleted_at) {
      return respond({ success: false, message: "User not found" }, corsHeaders, 404);
    }

    const clean: Record<string, any> = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    const setField = (key: string, next: unknown, { normalizeId = false } = {}) => {
      const cur = (existing as any)[key];
      let v = next;
      if (typeof v === "string") v = v.trim();
      if (normalizeId && typeof v === "string") v = v.replace(/\s+/g, "").trim();
      const curNorm = typeof cur === "string"
        ? (normalizeId ? cur.replace(/\s+/g, "").trim() : cur.trim())
        : cur;
      const nextNorm = typeof v === "string" ? v : v;
      if (next === undefined) return;
      if (next === null) {
        // do not allow clearing required core fields
        if (key === "last_name" || key === "id_number" || key === "phone") {
          throw new Error(`${key} is required`);
        }
        if (cur !== null) {
          clean[key] = null;
          changed[key] = { from: cur, to: null };
        }
        return;
      }
      if (typeof nextNorm === "string" && !nextNorm) {
        if (key === "last_name" || key === "id_number" || key === "phone") {
          throw new Error(`${key} is required`);
        }
        if (cur !== null) {
          clean[key] = null;
          changed[key] = { from: cur, to: null };
        }
        return;
      }
      if (nextNorm !== curNorm) {
        clean[key] = nextNorm;
        changed[key] = { from: cur, to: nextNorm };
      }
    };

    // Allowed staff edits
    if ("first_name" in updates) setField("first_name", (updates as any).first_name);
    if ("last_name" in updates) setField("last_name", (updates as any).last_name);
    if ("phone" in updates) setField("phone", (updates as any).phone);
    if ("email" in updates) setField("email", (updates as any).email);
    if ("village" in updates) setField("village", (updates as any).village);
    if ("ward" in updates) setField("ward", (updates as any).ward);

    if ("id_number" in updates) {
      const raw = (updates as any).id_number;
      if (raw !== null && typeof raw !== "string") {
        return respond({ success: false, message: "Invalid id_number" }, corsHeaders, 400);
      }
      const idn = raw === null ? "" : String(raw).replace(/\s+/g, "").trim();
      if (!idn) return respond({ success: false, message: "ID number is required." }, corsHeaders, 400);
      const currentNorm = String(existing.id_number || "").replace(/\s+/g, "").trim();
      if (idn !== currentNorm) {
        const { data: other } = await supabase
          .from("users")
          .select("id")
          .eq("id_number", idn)
          .neq("id", userId)
          .maybeSingle();
        if (other) {
          return respond(
            { success: false, message: "That ID number is already registered to another account." },
            corsHeaders,
            400,
          );
        }
        clean.id_number = idn.slice(0, 50);
        changed.id_number = { from: existing.id_number, to: clean.id_number };
      }
    }

    if ("date_of_birth" in updates) {
      const v = (updates as any).date_of_birth;
      let next: string | null = null;
      if (v === null || v === undefined || v === "") {
        next = null;
      } else if (typeof v === "string") {
        const s = v.trim();
        if (!s) next = null;
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          return respond({ success: false, message: "Invalid date of birth (use YYYY-MM-DD)." }, corsHeaders, 400);
        } else next = s;
      } else {
        return respond({ success: false, message: "Invalid date of birth" }, corsHeaders, 400);
      }
      const existingSlice =
        typeof existing.date_of_birth === "string" && existing.date_of_birth.length >= 10
          ? existing.date_of_birth.slice(0, 10)
          : null;
      if (next !== existingSlice) {
        clean.date_of_birth = next;
        changed.date_of_birth = { from: existingSlice, to: next };
      }
    }

    if (Object.keys(clean).length === 0) {
      return respond({ success: true, user: existing, changed: {} }, corsHeaders, 200);
    }

    const { data: updated, error: upErr } = await supabase
      .from("users")
      .update(clean)
      .eq("id", userId)
      .select("id, first_name, last_name, id_number, phone, email, date_of_birth, village, ward")
      .single();
    if (upErr || !updated) {
      return respond({ success: false, message: upErr?.message || "Failed to update user" }, corsHeaders, 500);
    }

    const msg = "Staff updated member details";
    await logUserActivity(supabase, {
      actorId: session.user_id,
      actorRole: String(session.role || "staff"),
      targetUserId: userId,
      targetDisplayName: displayName(updated),
      action: "USER_UPDATED",
      message: msg,
      metadata: { org_id: orgId, changed },
    });

    await logOrgItemActivity(supabase, {
      org_id: orgId,
      item_id: null,
      actor_user_id: session.user_id,
      action: "ORG_MEMBER_DETAILS_UPDATED",
      metadata: { user_id: userId, changed },
    });

    return respond({ success: true, user: updated, changed }, corsHeaders, 200);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("required")) return respond({ success: false, message: msg }, corsHeaders, 400);
    console.error("staff-update-org-member-user crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
}