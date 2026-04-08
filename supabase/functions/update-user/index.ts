// supabase/functions/update-user/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_ROLES = ["user", "admin", "police", "cashier"];
const ALLOWED_STATUS = ["active", "suspended", "disabled"];

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
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    const body = await req.json().catch(() => null);
    const { id, updates } = body ?? {};

    if (!id || typeof id !== "string" || !updates || typeof updates !== "object") {
      return respond({ success: false, message: "Invalid request" }, corsHeaders, 400);
    }

    const isSelf = String(session.user_id) === String(id);
    const privileged = isPrivilegedRole(session.role);

    if (!isSelf && !privileged) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    if (isSelf && !privileged) {
      if ("role" in updates || "status" in updates || "suspended_reason" in updates) {
        return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
      }
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("users")
      .select("id, role, status, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existing || existing.deleted_at) {
      return respond({ success: false, message: "User not found" }, corsHeaders, 404);
    }

    // Prevent privileged users from editing themselves into a lockout accidentally.
    if (String(session.user_id) === String(id)) {
      // allow profile edits, but restrict role/status changes on self
    }

    const clean: Record<string, unknown> = {};

    const setIfString = (key: string, max = 200, { required = false } = {}) => {
      if (!(key in updates)) return;
      const v = updates[key];
      if (v === null) {
        if (required) {
          throw new Error(`${key} is required`);
        }
        clean[key] = null;
        return;
      }
      if (typeof v !== "string") return;
      const s = v.trim();
      if (!s) {
        if (required) throw new Error(`${key} is required`);
        clean[key] = null;
        return;
      }
      clean[key] = s.slice(0, max);
    };

    setIfString("first_name", 100);
    setIfString("last_name", 100, { required: true });
    setIfString("email", 254);
    setIfString("phone", 50, { required: true });
    setIfString("police_station", 200);
    setIfString("village", 200);
    setIfString("ward", 200);

    if ("role" in updates) {
      const next = String(updates.role ?? "").trim().toLowerCase();
      // Only admins can change roles.
      if (session.role !== "admin") {
        return respond({ success: false, message: "Only admins can change roles" }, corsHeaders, 403);
      }
      if (!ALLOWED_ROLES.includes(next)) {
        return respond({ success: false, message: "Invalid role" }, corsHeaders, 400);
      }
      if (String(session.user_id) === String(id) && next !== existing.role) {
        return respond({ success: false, message: "You cannot change your own role" }, corsHeaders, 400);
      }
      clean.role = next;
    }

    if ("status" in updates) {
      const next = String(updates.status ?? "").trim().toLowerCase();
      // Only admins can change status.
      if (session.role !== "admin") {
        return respond({ success: false, message: "Only admins can change status" }, corsHeaders, 403);
      }
      if (!ALLOWED_STATUS.includes(next)) {
        return respond({ success: false, message: "Invalid status" }, corsHeaders, 400);
      }
      if (String(session.user_id) === String(id)) {
        return respond({ success: false, message: "You cannot deactivate your own account" }, corsHeaders, 400);
      }

      const statusChanged = String(existing.status || "").toLowerCase() !== next;
      if (statusChanged) {
        const reason =
          typeof (updates as { suspended_reason?: unknown }).suspended_reason === "string"
            ? String((updates as { suspended_reason: string }).suspended_reason).trim()
            : "";

        if (next !== "active" && !reason) {
          return respond(
            { success: false, message: "A reason is required to change status." },
            corsHeaders,
            400,
          );
        }

        clean.status = next;

        if (next === "active") {
          clean.suspended_reason = null;
          clean.suspended_at = null;
        } else {
          clean.suspended_reason = reason;
          clean.suspended_at = new Date().toISOString();
        }
      }
    }

    // prune no-op / undefined
    const entries = Object.entries(clean).filter(([, v]) => typeof v !== "undefined");
    if (entries.length === 0) {
      return respond({ success: true, message: "No changes" }, corsHeaders, 200);
    }

    const { data: updated, error: upErr } = await supabase
      .from("users")
      .update(clean)
      .eq("id", id)
      .select("id, first_name, last_name, id_number, phone, email, role, police_station, village, ward, status")
      .single();

    if (upErr || !updated) {
      return respond({ success: false, message: upErr?.message || "Failed to update user" }, corsHeaders, 500);
    }

    return respond({ success: true, user: updated }, corsHeaders, 200);
  } catch (err: any) {
    // Treat our explicit validation errors as 400s.
    const msg = err?.message || "Unexpected server error";
    const isValidation =
      typeof msg === "string" &&
      (msg.includes(" is required") || msg.startsWith("Invalid "));

    if (!isValidation) console.error("update-user crash:", err);
    return respond(
      { success: false, message: msg },
      corsHeaders,
      isValidation ? 400 : 500,
    );
  }
});

