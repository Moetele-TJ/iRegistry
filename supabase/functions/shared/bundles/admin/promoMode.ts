import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../../cors.ts";
import { respond } from "../../respond.ts";
import { validateSession } from "../../validateSession.ts";
import { roleIs } from "../../roles.ts";
import { logAudit } from "../../logAudit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function asIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const session = await validateSession(supabase, auth);
  if (!session) return { session: null, res: respond({ success: false, message: "Unauthorized" }, getCorsHeaders(req), 401) };
  if (!roleIs(session.role, "admin")) return { session: null, res: respond({ success: false, message: "Forbidden" }, getCorsHeaders(req), 403) };
  return { session, res: null as Response | null };
}

export async function runGetPromoConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const { data: cfg, error: cfgErr } = await supabase
    .from("system_promo_config")
    .select("id, enabled, starts_at, ends_at, note, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();

  if (cfgErr) return respond({ success: false, message: cfgErr.message || "Failed to load promo config" }, corsHeaders, 500);

  const { data: rows, error: eErr } = await supabase
    .from("user_promo_enrollments")
    .select("id, user_id, starts_at, ends_at, note, created_at, created_by, updated_at, updated_by")
    .order("created_at", { ascending: false })
    .limit(200);

  if (eErr) return respond({ success: false, message: eErr.message || "Failed to load promo users" }, corsHeaders, 500);

  const enrollments = Array.isArray(rows) ? rows : [];
  const userIds = [...new Set(enrollments.map((r: any) => String(r.user_id)))];

  let usersById = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, id_number, role")
      .in("id", userIds);
    if (uErr) {
      console.error("promoMode users lookup:", uErr.message);
    } else {
      usersById = new Map((users || []).map((u: any) => [String(u.id), u]));
    }
  }

  const merged = enrollments.map((e: any) => ({
    ...e,
    user: usersById.get(String(e.user_id)) ?? null,
  }));

  await logAudit({
    supabase,
    event: "PROMO_CONFIG_VIEWED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "low",
    diag: "PROMO-GET",
    metadata: {},
    req,
  });

  return respond(
    {
      success: true,
      config: cfg ?? { id: 1, enabled: false, starts_at: null, ends_at: null, note: null },
      enrollments: merged,
    },
    corsHeaders,
    200,
  );
}

export async function runSetPromoConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const enabled = typeof (body as any)?.enabled === "boolean" ? (body as any).enabled : null;
  if (enabled == null) return respond({ success: false, message: "enabled is required" }, corsHeaders, 400);

  const starts_at = asIsoOrNull((body as any)?.starts_at);
  const ends_at = asIsoOrNull((body as any)?.ends_at);
  const note = typeof (body as any)?.note === "string" ? String((body as any).note).trim() || null : null;

  if (starts_at && ends_at && new Date(starts_at).getTime() > new Date(ends_at).getTime()) {
    return respond({ success: false, message: "starts_at must be <= ends_at" }, corsHeaders, 400);
  }

  const { data, error } = await supabase
    .from("system_promo_config")
    .upsert(
      {
        id: 1,
        enabled,
        starts_at,
        ends_at,
        note,
        updated_by: session.user_id,
      },
      { onConflict: "id" },
    )
    .select("id, enabled, starts_at, ends_at, note, updated_at, updated_by")
    .single();

  if (error || !data) {
    return respond({ success: false, message: error?.message || "Failed to save promo config" }, corsHeaders, 500);
  }

  await logAudit({
    supabase,
    event: "PROMO_CONFIG_UPDATED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "PROMO-SET",
    metadata: { enabled, starts_at, ends_at },
    req,
  });

  return respond({ success: true, config: data }, corsHeaders, 200);
}

export async function runUpsertPromoEnrollment(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = typeof (body as any)?.id === "string" ? String((body as any).id).trim() : "";
  const user_id = typeof (body as any)?.user_id === "string" ? String((body as any).user_id).trim() : "";
  if (!user_id) return respond({ success: false, message: "user_id is required" }, corsHeaders, 400);

  const starts_at = asIsoOrNull((body as any)?.starts_at) ?? new Date().toISOString();
  const ends_at = asIsoOrNull((body as any)?.ends_at);
  const note = typeof (body as any)?.note === "string" ? String((body as any).note).trim() || null : null;

  if (ends_at && new Date(starts_at).getTime() > new Date(ends_at).getTime()) {
    return respond({ success: false, message: "starts_at must be <= ends_at" }, corsHeaders, 400);
  }

  const payload: Record<string, unknown> = {
    user_id,
    starts_at,
    ends_at,
    note,
    updated_by: session.user_id,
  };
  if (!id) payload.created_by = session.user_id;
  if (id) payload.id = id;

  const { data, error } = await supabase
    .from("user_promo_enrollments")
    .upsert(payload, { onConflict: "id" })
    .select("id, user_id, starts_at, ends_at, note, created_at, created_by, updated_at, updated_by")
    .single();

  if (error || !data) {
    return respond({ success: false, message: error?.message || "Failed to save enrollment" }, corsHeaders, 500);
  }

  await logAudit({
    supabase,
    event: "PROMO_USER_UPSERTED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "PROMO-USER-UP",
    metadata: { id: data.id, user_id: data.user_id, starts_at: data.starts_at, ends_at: data.ends_at },
    req,
  });

  return respond({ success: true, enrollment: data }, corsHeaders, 200);
}

export async function runDeletePromoEnrollment(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = typeof (body as any)?.id === "string" ? String((body as any).id).trim() : "";
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const { data: existing } = await supabase
    .from("user_promo_enrollments")
    .select("id, user_id, starts_at, ends_at")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("user_promo_enrollments")
    .delete()
    .eq("id", id);

  if (error) return respond({ success: false, message: error.message || "Failed to delete enrollment" }, corsHeaders, 500);

  await logAudit({
    supabase,
    event: "PROMO_USER_DELETED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "PROMO-USER-DEL",
    metadata: { id, user_id: (existing as any)?.user_id ?? null },
    req,
  });

  return respond({ success: true }, corsHeaders, 200);
}

