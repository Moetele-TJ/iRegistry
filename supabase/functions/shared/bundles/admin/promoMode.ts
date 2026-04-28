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

function asIsoRequired(v: unknown, label: string): string {
  const iso = asIsoOrNull(v);
  if (!iso) throw new Error(`${label} is required`);
  return iso;
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

  const nowIso = new Date().toISOString();

  const { data: activeSystem, error: aErr } = await supabase
    .from("promo_campaigns")
    .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
    .eq("scope", "system")
    .lte("starts_at", nowIso)
    .gt("proposed_ends_at", nowIso)
    .is("ended_at", null)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (aErr) return respond({ success: false, message: aErr.message || "Failed to load active system promo" }, corsHeaders, 500);

  const { data: systemHistory, error: shErr } = await supabase
    .from("promo_campaigns")
    .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
    .eq("scope", "system")
    .order("created_at", { ascending: false })
    .limit(5);

  if (shErr) return respond({ success: false, message: shErr.message || "Failed to load system promo history" }, corsHeaders, 500);

  const { data: userRows, error: uPromoErr } = await supabase
    .from("promo_campaigns")
    .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
    .eq("scope", "user")
    .order("created_at", { ascending: false })
    .limit(200);

  if (uPromoErr) return respond({ success: false, message: uPromoErr.message || "Failed to load user promos" }, corsHeaders, 500);

  const promos = Array.isArray(userRows) ? userRows : [];
  const userIds = [...new Set(promos.map((r: any) => String(r.user_id)).filter(Boolean))];

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

  const merged = promos.map((e: any) => ({
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
      system_active: activeSystem ?? null,
      system_history: Array.isArray(systemHistory) ? systemHistory : [],
      user_promos: merged,
    },
    corsHeaders,
    200,
  );
}

export async function runUpsertSystemPromo(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof (body as any)?.id === "string" ? String((body as any).id).trim() : "";
    const starts_at = asIsoRequired((body as any)?.starts_at, "starts_at");
    const proposed_ends_at = asIsoRequired((body as any)?.proposed_ends_at, "proposed_ends_at");
    const note = typeof (body as any)?.note === "string" ? String((body as any).note).trim() || null : null;

    if (new Date(starts_at).getTime() >= new Date(proposed_ends_at).getTime()) {
      return respond({ success: false, message: "starts_at must be < proposed_ends_at" }, corsHeaders, 400);
    }

    const payload: Record<string, unknown> = {
      scope: "system",
      user_id: null,
      starts_at,
      proposed_ends_at,
      note,
      updated_by: session.user_id,
    };
    if (!id) payload.created_by = session.user_id;
    if (id) payload.id = id;

    const { data, error } = await supabase
      .from("promo_campaigns")
      .upsert(payload, { onConflict: "id" })
      .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
      .single();

    if (error || !data) {
      const msg = String(error?.message || "Failed to save system promo");
      return respond({ success: false, message: msg }, corsHeaders, 500);
    }

    await logAudit({
      supabase,
      event: "PROMO_SYSTEM_UPSERTED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "PROMO-SYS-UP",
      metadata: { id: data.id, starts_at: data.starts_at, proposed_ends_at: data.proposed_ends_at },
      req,
    });

    return respond({ success: true, promo: data }, corsHeaders, 200);
  } catch (e: any) {
    return respond({ success: false, message: e?.message || "Invalid request" }, corsHeaders, 400);
  }
}

export async function runEndSystemPromo(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = typeof (body as any)?.id === "string" ? String((body as any).id).trim() : "";
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const { data: existing } = await supabase
    .from("promo_campaigns")
    .select("id, scope, starts_at, proposed_ends_at, ended_at")
    .eq("id", id)
    .eq("scope", "system")
    .maybeSingle();

  const { data, error } = await supabase
    .from("promo_campaigns")
    .update({ ended_at: new Date().toISOString(), updated_by: session.user_id })
    .eq("id", id)
    .eq("scope", "system")
    .is("ended_at", null)
    .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
    .maybeSingle();

  if (error) return respond({ success: false, message: error.message || "Failed to end promo" }, corsHeaders, 500);

  await logAudit({
    supabase,
    event: "PROMO_SYSTEM_ENDED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "PROMO-SYS-END",
    metadata: { id, prev: existing ?? null },
    req,
  });

  return respond({ success: true, promo: data ?? null }, corsHeaders, 200);
}

export async function runUpsertUserPromo(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof (body as any)?.id === "string" ? String((body as any).id).trim() : "";
    const user_id = typeof (body as any)?.user_id === "string" ? String((body as any).user_id).trim() : "";
    if (!user_id) return respond({ success: false, message: "user_id is required" }, corsHeaders, 400);

    const starts_at = asIsoRequired((body as any)?.starts_at, "starts_at");
    const proposed_ends_at = asIsoRequired((body as any)?.proposed_ends_at, "proposed_ends_at");
    const note = typeof (body as any)?.note === "string" ? String((body as any).note).trim() || null : null;

    if (new Date(starts_at).getTime() >= new Date(proposed_ends_at).getTime()) {
      return respond({ success: false, message: "starts_at must be < proposed_ends_at" }, corsHeaders, 400);
    }

    const payload: Record<string, unknown> = {
      scope: "user",
      user_id,
      starts_at,
      proposed_ends_at,
      note,
      updated_by: session.user_id,
    };
    if (!id) payload.created_by = session.user_id;
    if (id) payload.id = id;

    const { data, error } = await supabase
      .from("promo_campaigns")
      .upsert(payload, { onConflict: "id" })
      .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
      .single();

    if (error || !data) {
      const msg = String(error?.message || "Failed to save user promo");
      return respond({ success: false, message: msg }, corsHeaders, 500);
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
      metadata: { id: data.id, user_id: data.user_id, starts_at: data.starts_at, proposed_ends_at: data.proposed_ends_at },
      req,
    });

    return respond({ success: true, promo: data }, corsHeaders, 200);
  } catch (e: any) {
    return respond({ success: false, message: e?.message || "Invalid request" }, corsHeaders, 400);
  }
}

export async function runEndUserPromo(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = typeof (body as any)?.id === "string" ? String((body as any).id).trim() : "";
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const { data: existing } = await supabase
    .from("promo_campaigns")
    .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at")
    .eq("id", id)
    .eq("scope", "user")
    .maybeSingle();

  const { data, error } = await supabase
    .from("promo_campaigns")
    .update({ ended_at: new Date().toISOString(), updated_by: session.user_id })
    .eq("id", id)
    .eq("scope", "user")
    .is("ended_at", null)
    .select("id, scope, user_id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by")
    .maybeSingle();

  if (error) return respond({ success: false, message: error.message || "Failed to end promo" }, corsHeaders, 500);

  await logAudit({
    supabase,
    event: "PROMO_USER_ENDED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "PROMO-USER-END",
    metadata: { id, prev: existing ?? null },
    req,
  });

  return respond({ success: true, promo: data ?? null }, corsHeaders, 200);
}

