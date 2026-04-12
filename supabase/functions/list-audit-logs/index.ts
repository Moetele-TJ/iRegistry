import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { roleIs } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function isUuid(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    )
  );
}

function clampLimit(n: unknown, fallback: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 1) return fallback;
  return Math.min(Math.floor(x), max);
}

function clampOffset(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
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
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success: false, message: "Unauthorized" },
        corsHeaders,
        401,
      );
    }

    if (!roleIs(session.role, "admin")) {
      return respond(
        { success: false, message: "Forbidden" },
        corsHeaders,
        403,
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      limit: rawLimit,
      offset: rawOffset,
      user_id: filterUserId,
      event_q: rawEventQ,
      success: rawSuccess,
      severity: rawSeverity,
    } = body ?? {};

    const limit = clampLimit(rawLimit, 50, 200);
    const offset = clampOffset(rawOffset);

    const eventQ =
      typeof rawEventQ === "string" ? rawEventQ.trim().slice(0, 120) : "";
    const severity =
      typeof rawSeverity === "string" ? rawSeverity.trim().slice(0, 32) : "";

    let q = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filterUserId && typeof filterUserId === "string" && filterUserId) {
      q = q.eq("user_id", filterUserId);
    }

    if (rawSuccess === true || rawSuccess === false) {
      q = q.eq("success", rawSuccess);
    }

    if (severity) {
      q = q.eq("severity", severity);
    }

    if (eventQ) {
      const esc = eventQ.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(
        /_/g,
        "\\_",
      );
      q = q.or(`event.ilike.%${esc}%,diag.ilike.%${esc}%`);
    }

    const { data: rows, error, count } = await q;

    if (error) {
      console.error("list-audit-logs:", error.message);
      return respond(
        { success: false, message: error.message || "Failed to list audit logs" },
        corsHeaders,
        500,
      );
    }

    const list = rows || [];
    const uuids = [
      ...new Set(
        list.map((r: { user_id?: unknown }) => r.user_id).filter(isUuid),
      ),
    ];

    const userById = new Map<
      string,
      { first_name: string | null; last_name: string | null; email: string | null }
    >();

    if (uuids.length > 0) {
      const { data: users, error: uErr } = await supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .in("id", uuids);

      if (uErr) {
        console.error("list-audit-logs users:", uErr.message);
      } else {
        for (const u of users || []) {
          const id = (u as { id?: string }).id;
          if (typeof id === "string") userById.set(id, u as any);
        }
      }
    }

    const logs = list.map((row: Record<string, unknown>) => {
      const uid = row.user_id;
      let user: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null = null;
      if (typeof uid === "string" && userById.has(uid)) {
        user = userById.get(uid)!;
      }
      return { ...row, user };
    });

    return respond(
      {
        success: true,
        logs,
        total: count ?? 0,
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("list-audit-logs crash:", err);
    return respond(
      { success: false, message: "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
