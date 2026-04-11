import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { logAudit } from "../shared/logAudit.ts";
import { roleIs } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/** Max absolute expiry from "now" after an extend (30 days). */
const MAX_FUTURE_FROM_NOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Single extend request: at most 7 days. */
const MAX_EXTEND_MINUTES = 7 * 24 * 60;

function isUuid(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    )
  );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(
      { success: false, message: "Method not allowed" },
      corsHeaders,
      405,
    );
  }

  try {
    const auth = req.headers.get("authorization") ||
      req.headers.get("Authorization");
    const caller = await validateSession(supabase, auth);

    if (!caller) {
      return respond(
        { success: false, message: "Unauthorized" },
        corsHeaders,
        401,
      );
    }

    if (!roleIs(caller.role, "admin")) {
      return respond(
        { success: false, message: "Forbidden" },
        corsHeaders,
        403,
      );
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;

    if (action === "list") {
      const nowIso = new Date().toISOString();

      const { data: rows, error } = await supabase
        .from("sessions")
        .select("id, user_id, role, expires_at, ip_address, user_agent, revoked")
        .eq("revoked", false)
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: true });

      if (error) {
        console.error("admin-sessions list:", error.message);
        return respond(
          { success: false, message: "Failed to load sessions" },
          corsHeaders,
          500,
        );
      }

      const sessions = rows || [];
      const userIds = [...new Set(sessions.map((r: { user_id: string }) => r.user_id))];

      let userMap = new Map<
        string,
        { first_name: string | null; last_name: string | null; email: string | null }
      >();

      if (userIds.length > 0) {
        const { data: users, error: uErr } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        if (uErr) {
          console.error("admin-sessions users:", uErr.message);
        } else {
          userMap = new Map(
            (users || []).map((u: any) => [
              u.id,
              {
                first_name: u.first_name,
                last_name: u.last_name,
                email: u.email,
              },
            ]),
          );
        }
      }

      const enriched = sessions.map((s: any) => {
        const u = userMap.get(s.user_id);
        return {
          ...s,
          user_first_name: u?.first_name ?? null,
          user_last_name: u?.last_name ?? null,
          user_email: u?.email ?? null,
        };
      });

      return respond({ success: true, sessions: enriched }, corsHeaders, 200);
    }

    if (action === "revoke") {
      const sessionId = body?.session_id;
      if (!isUuid(sessionId)) {
        return respond(
          { success: false, message: "Invalid session id" },
          corsHeaders,
          400,
        );
      }

      const { data: target, error: fetchErr } = await supabase
        .from("sessions")
        .select("id, user_id, revoked")
        .eq("id", sessionId)
        .maybeSingle();

      if (fetchErr || !target) {
        return respond(
          { success: false, message: "Session not found" },
          corsHeaders,
          404,
        );
      }

      if (target.revoked) {
        return respond(
          { success: true, message: "Session already revoked" },
          corsHeaders,
          200,
        );
      }

      const { error: upErr } = await supabase
        .from("sessions")
        .update({ revoked: true })
        .eq("id", sessionId)
        .eq("revoked", false);

      if (upErr) {
        return respond(
          { success: false, message: "Failed to revoke session" },
          corsHeaders,
          500,
        );
      }

      await logAudit({
        supabase,
        event: "ADMIN_SESSION_REVOKE",
        user_id: target.user_id,
        success: true,
        diag: "ADM-SES-REV",
        req,
      });

      return respond(
        { success: true, message: "Session revoked" },
        corsHeaders,
        200,
      );
    }

    if (action === "extend") {
      const sessionId = body?.session_id;
      const extendMinutes = Number(body?.extend_minutes);

      if (!isUuid(sessionId)) {
        return respond(
          { success: false, message: "Invalid session id" },
          corsHeaders,
          400,
        );
      }

      if (
        !Number.isFinite(extendMinutes) ||
        extendMinutes < 1 ||
        extendMinutes > MAX_EXTEND_MINUTES
      ) {
        return respond(
          {
            success: false,
            message: `extend_minutes must be between 1 and ${MAX_EXTEND_MINUTES}`,
          },
          corsHeaders,
          400,
        );
      }

      const { data: target, error: fetchErr } = await supabase
        .from("sessions")
        .select("id, user_id, expires_at, revoked")
        .eq("id", sessionId)
        .maybeSingle();

      if (fetchErr || !target) {
        return respond(
          { success: false, message: "Session not found" },
          corsHeaders,
          404,
        );
      }

      if (target.revoked) {
        return respond(
          { success: false, message: "Cannot extend a revoked session" },
          corsHeaders,
          400,
        );
      }

      const now = Date.now();
      const currentExpiry = new Date(target.expires_at).getTime();
      if (currentExpiry <= now) {
        return respond(
          { success: false, message: "Session has already expired" },
          corsHeaders,
          400,
        );
      }

      const addMs = extendMinutes * 60 * 1000;
      const cap = now + MAX_FUTURE_FROM_NOW_MS;
      const proposed = currentExpiry + addMs;
      const newExpiry = new Date(Math.min(proposed, cap));

      if (newExpiry.getTime() <= currentExpiry) {
        return respond(
          { success: false, message: "Nothing to extend (already at cap)" },
          corsHeaders,
          400,
        );
      }

      const { error: upErr } = await supabase
        .from("sessions")
        .update({ expires_at: newExpiry.toISOString() })
        .eq("id", sessionId)
        .eq("revoked", false);

      if (upErr) {
        return respond(
          { success: false, message: "Failed to extend session" },
          corsHeaders,
          500,
        );
      }

      await logAudit({
        supabase,
        event: "ADMIN_SESSION_EXTEND",
        user_id: target.user_id,
        success: true,
        diag: "ADM-SES-EXT",
        req,
      });

      return respond(
        {
          success: true,
          message: "Session extended",
          expires_at: newExpiry.toISOString(),
        },
        corsHeaders,
        200,
      );
    }

    if (action === "revoke_user") {
      const userId = body?.user_id;
      if (!isUuid(userId)) {
        return respond(
          { success: false, message: "Invalid user id" },
          corsHeaders,
          400,
        );
      }

      const { data: revokedRows, error: upErr } = await supabase
        .from("sessions")
        .update({ revoked: true })
        .eq("user_id", userId)
        .eq("revoked", false)
        .select("id");

      if (upErr) {
        return respond(
          { success: false, message: "Failed to revoke sessions" },
          corsHeaders,
          500,
        );
      }

      const count = revokedRows?.length ?? 0;

      await logAudit({
        supabase,
        event: "ADMIN_SESSION_REVOKE_USER",
        user_id: userId,
        success: true,
        diag: `ADM-SES-REVALL-${count}`,
        req,
      });

      return respond(
        {
          success: true,
          message: count === 0
            ? "No active sessions for this user"
            : `Revoked ${count} session(s)`,
          revoked_count: count,
        },
        corsHeaders,
        200,
      );
    }

    return respond(
      { success: false, message: "Unknown action" },
      corsHeaders,
      400,
    );
  } catch (err: unknown) {
    console.error("admin-sessions crash:", err);
    return respond(
      { success: false, message: "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
