// supabase/functions/update-user/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";
import { logAudit } from "../shared/logAudit.ts";
import { logUserActivity } from "../shared/logUserActivity.ts";
import { summarizeUserRecordUpdate } from "../shared/userActivityMessages.ts";
import { deriveUserStatus } from "../shared/userState.ts";

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
      .select("id, role, deleted_at, suspended_at, suspended_reason, disabled_at, disabled_reason, id_number, date_of_birth")
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

    if ("id_number" in updates) {
      const raw = (updates as { id_number?: unknown }).id_number;
      if (raw !== null && typeof raw !== "string") {
        return respond({ success: false, message: "Invalid id_number" }, corsHeaders, 400);
      }
      const idn = raw === null ? "" : String(raw).replace(/\s+/g, "").trim();
      if (!idn) {
        return respond(
          { success: false, message: "National ID / Passport is required." },
          corsHeaders,
          400,
        );
      }
      const existingIdNorm = String((existing as { id_number?: string | null }).id_number ?? "")
        .replace(/\s+/g, "")
        .trim();
      if (idn !== existingIdNorm) {
        const { data: other } = await supabase
          .from("users")
          .select("id")
          .eq("id_number", idn)
          .neq("id", id)
          .maybeSingle();
        if (other) {
          return respond(
            {
              success: false,
              message: "That ID / Passport number is already registered to another account.",
            },
            corsHeaders,
            400,
          );
        }
      }
      if (idn !== existingIdNorm) {
        clean.id_number = idn.slice(0, 50);
      }
    }

    if ("date_of_birth" in updates) {
      const v = (updates as { date_of_birth?: unknown }).date_of_birth;
      let next: string | null = null;
      if (v === null || v === undefined) {
        next = null;
      } else if (typeof v === "string") {
        const s = v.trim();
        if (!s) {
          next = null;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          return respond(
            { success: false, message: "Invalid date of birth (use YYYY-MM-DD)." },
            corsHeaders,
            400,
          );
        } else {
          next = s;
        }
      } else {
        return respond({ success: false, message: "Invalid date of birth" }, corsHeaders, 400);
      }
      const existingRow = existing as { date_of_birth?: string | null };
      const existingSlice =
        typeof existingRow.date_of_birth === "string" && existingRow.date_of_birth.length >= 10
          ? existingRow.date_of_birth.slice(0, 10)
          : null;
      if (next !== existingSlice) {
        clean.date_of_birth = next;
      }
    }

    if ("role" in updates) {
      const next = String(updates.role ?? "").trim().toLowerCase();
      // Only admins can change roles.
      if (!roleIs(session.role, "admin")) {
        return respond({ success: false, message: "Only admins can change roles" }, corsHeaders, 403);
      }
      if (!ALLOWED_ROLES.includes(next)) {
        return respond({ success: false, message: "Invalid role" }, corsHeaders, 400);
      }
      if (String(session.user_id) === String(id) && next !== existing.role) {
        return respond({ success: false, message: "You cannot change your own role" }, corsHeaders, 400);
      }
      const existingRole = String((existing as { role?: string | null }).role ?? "")
        .trim()
        .toLowerCase();
      if (next !== existingRole) {
        clean.role = next;
      }
    }

    if ("status" in updates) {
      const next = String(updates.status ?? "").trim().toLowerCase();
      // Only admins can change status.
      if (!roleIs(session.role, "admin")) {
        return respond({ success: false, message: "Only admins can change status" }, corsHeaders, 403);
      }
      if (!ALLOWED_STATUS.includes(next)) {
        return respond({ success: false, message: "Invalid status" }, corsHeaders, 400);
      }
      if (String(session.user_id) === String(id)) {
        return respond({ success: false, message: "You cannot deactivate your own account" }, corsHeaders, 400);
      }

      const statusChanged = deriveUserStatus(existing) !== next;
      if (statusChanged) {
        const suspendedReason =
          typeof (updates as { suspended_reason?: unknown }).suspended_reason === "string"
            ? String((updates as { suspended_reason: string }).suspended_reason).trim()
            : "";
        const disabledReason =
          typeof (updates as { disabled_reason?: unknown }).disabled_reason === "string"
            ? String((updates as { disabled_reason: string }).disabled_reason).trim()
            : "";

        if (next === "suspended" && !suspendedReason) {
          return respond(
            { success: false, message: "A reason is required to change status." },
            corsHeaders,
            400,
          );
        }
        if (next === "disabled" && !disabledReason) {
          return respond(
            { success: false, message: "A reason is required to change status." },
            corsHeaders,
            400,
          );
        }

        if (next === "active") {
          clean.suspended_reason = null;
          clean.suspended_at = null;
          clean.disabled_reason = null;
          clean.disabled_at = null;
        } else {
          const now = new Date().toISOString();
          if (next === "suspended") {
            clean.suspended_reason = suspendedReason;
            clean.suspended_at = now;
            clean.disabled_reason = null;
            clean.disabled_at = null;
          }
          if (next === "disabled") {
            clean.disabled_reason = disabledReason;
            clean.disabled_at = now;
            clean.suspended_reason = null;
            clean.suspended_at = null;
          }
        }
      }
    }

    // Allow admins to update suspension/disable reason text without a status transition.
    if (roleIs(session.role, "admin")) {
      const der = deriveUserStatus(existing);
      if (der === "suspended" && "suspended_reason" in updates) {
        const raw = (updates as { suspended_reason?: unknown }).suspended_reason;
        if (typeof raw === "string") {
          const sr = raw.trim();
          if (sr !== String((existing as { suspended_reason?: string | null }).suspended_reason ?? "").trim()) {
            clean.suspended_reason = sr.slice(0, 500);
          }
        }
      }
      if (der === "disabled" && "disabled_reason" in updates) {
        const raw = (updates as { disabled_reason?: unknown }).disabled_reason;
        if (typeof raw === "string") {
          const dr = raw.trim();
          if (dr !== String((existing as { disabled_reason?: string | null }).disabled_reason ?? "").trim()) {
            clean.disabled_reason = dr.slice(0, 500);
          }
        }
      }
    }

    const targetStatus = deriveUserStatus(existing);
    if (targetStatus === "suspended" || targetStatus === "disabled") {
      const blocked = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "police_station",
        "village",
        "ward",
        "id_number",
        "date_of_birth",
        "role",
      ];
      if (blocked.some((k) => k in clean)) {
        return respond(
          {
            success: false,
            message:
              "This account is suspended or disabled. Profile details and roles cannot be changed until the account is reactivated.",
          },
          corsHeaders,
          403,
        );
      }
    }

    // prune no-op / undefined
    const entries = Object.entries(clean).filter(([, v]) => typeof v !== "undefined");
    if (entries.length === 0) {
      return respond({ success: true, message: "No changes" }, corsHeaders, 200);
    }

    const roleWillChange =
      typeof (clean as any).role === "string" &&
      String((clean as any).role).toLowerCase() !== String(existing.role || "").toLowerCase();

    const oldRole = String((existing as any)?.role || "").trim().toLowerCase();
    const newRole = roleWillChange ? String((clean as any).role || "").trim().toLowerCase() : "";
    const oldStatus = deriveUserStatus(existing);
    const newStatus = deriveUserStatus({ ...(existing as any), ...(clean as any) });

    const { data: updated, error: upErr } = await supabase
      .from("users")
      .update(clean)
      .eq("id", id)
      .select(
        "id, first_name, last_name, id_number, phone, email, role, police_station, village, ward, suspended_reason, suspended_at, disabled_reason, disabled_at, deleted_at, date_of_birth",
      )
      .single();

    if (upErr || !updated) {
      return respond({ success: false, message: upErr?.message || "Failed to update user" }, corsHeaders, 500);
    }

    // If an admin changes a user's role, revoke all existing sessions so they must log in again.
    // This prevents a stale session from continuing with the old role.
    if (roleWillChange || newStatus !== oldStatus) {
      const { error: revokeErr } = await supabase
        .from("sessions")
        .update({ revoked: true })
        .eq("user_id", id)
        .eq("revoked", false);

      if (revokeErr) {
        console.error("update-user: failed to revoke sessions after role change", revokeErr.message);
        // Do not fail the role change if revocation fails; client can still force re-login.
      }
    }

    // AUDIT: only for privileged changes (admin actions).
    if (roleIs(session.role, "admin") && roleWillChange) {
      await logAudit({
        supabase,
        event: "USER_ROLE_CHANGED",
        user_id: id,
        channel: "ADMIN",
        actor_user_id: session.user_id,
        target_user_id: id,
        success: true,
        severity: "high",
        diag: "USR-ROLE",
        metadata: {
          actor_user_id: session.user_id,
          target_user_id: id,
          from: oldRole || null,
          to: newRole || null,
        },
        req,
      });
    }

    if (roleIs(session.role, "admin") && newStatus && newStatus !== oldStatus) {
      const reason =
        newStatus === "suspended"
          ? (typeof (clean as any)?.suspended_reason === "string"
              ? String((clean as any).suspended_reason).trim().slice(0, 500)
              : "")
          : newStatus === "disabled"
          ? (typeof (clean as any)?.disabled_reason === "string"
              ? String((clean as any).disabled_reason).trim().slice(0, 500)
              : "")
          : "";
      await logAudit({
        supabase,
        event: "USER_STATUS_CHANGED",
        user_id: id,
        channel: "ADMIN",
        actor_user_id: session.user_id,
        target_user_id: id,
        success: true,
        severity: newStatus === "active" ? "medium" : "high",
        diag: "USR-STATUS",
        metadata: {
          actor_user_id: session.user_id,
          target_user_id: id,
          from: oldStatus || null,
          to: newStatus || null,
          reason: reason || null,
        },
        req,
      });
    }

    /* Profile timeline (user_activity_logs). */
    const u = updated as Record<string, unknown>;
    const displayName =
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
      String(u.email || "").trim() ||
      "User";
    const { action: uaAction, message: uaDetail, changedKeys } =
      summarizeUserRecordUpdate(clean);
    const selfEdit = String(session.user_id) === String(id);
    const uaMessage = selfEdit
      ? `You updated your account (${uaDetail})`
      : `Account updated (${uaDetail})`;
    await logUserActivity(supabase, {
      actorId: session.user_id,
      actorRole: String(session.role || "user"),
      targetUserId: id,
      targetDisplayName: displayName,
      action: uaAction,
      message: uaMessage,
      metadata: {
        changed_keys: changedKeys,
        self_edit: selfEdit,
      },
    });

    return respond(
      {
        success: true,
        user: {
          ...updated,
          status: deriveUserStatus(updated),
        },
      },
      corsHeaders,
      200,
    );
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

