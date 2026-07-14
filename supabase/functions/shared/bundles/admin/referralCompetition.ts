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

const CONFIG_SELECT =
  "competition_enabled, signup_button_enabled, competition_last_ended_at, leaderboard_override_visible, updated_at, updated_by";

const CAMPAIGN_SELECT =
  "id, starts_at, proposed_ends_at, ended_at, note, created_at, created_by, updated_at, updated_by";

type ReferralConfigRow = {
  competition_enabled?: boolean;
  signup_button_enabled?: boolean;
  competition_last_ended_at?: string | null;
  leaderboard_override_visible?: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
};

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
  if (!session) {
    return { session: null, res: respond({ success: false, message: "Unauthorized" }, getCorsHeaders(req), 401) };
  }
  if (!roleIs(session.role, "admin")) {
    return { session: null, res: respond({ success: false, message: "Forbidden" }, getCorsHeaders(req), 403) };
  }
  return { session, res: null as Response | null };
}

async function requireAdminOrCashier(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const session = await validateSession(supabase, auth);
  if (!session) {
    return { session: null, res: respond({ success: false, message: "Unauthorized" }, corsHeaders, 401) };
  }
  if (!roleIs(session.role, "admin") && !roleIs(session.role, "cashier")) {
    return { session: null, res: respond({ success: false, message: "Forbidden" }, corsHeaders, 403) };
  }
  return { session, res: null as Response | null };
}

function mapConfigRow(data: ReferralConfigRow | null) {
  return {
    competition_enabled: Boolean(data?.competition_enabled),
    signup_button_enabled: Boolean(data?.signup_button_enabled),
    competition_last_ended_at: data?.competition_last_ended_at ?? null,
    leaderboard_override_visible: Boolean(data?.leaderboard_override_visible),
    updated_at: data?.updated_at ?? null,
    updated_by: data?.updated_by ?? null,
  };
}

export async function loadReferralCompetitionConfig() {
  const { data, error } = await supabase
    .from("referral_competition_config")
    .select(CONFIG_SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to load referral competition config");

  return mapConfigRow(data as ReferralConfigRow | null);
}

async function loadReferralCompetitionActive() {
  const { data, error } = await supabase.rpc("is_referral_competition_active");
  if (error) throw new Error(error.message || "Failed to load referral competition status");
  return Boolean(data);
}

async function loadLeaderboardVisible() {
  const { data, error } = await supabase.rpc("is_referral_leaderboard_visible");
  if (error) throw new Error(error.message || "Failed to load leaderboard visibility");
  return Boolean(data);
}

async function loadLeaderboardVisibleUntil() {
  const { data, error } = await supabase.rpc("referral_leaderboard_visible_until");
  if (error) throw new Error(error.message || "Failed to load leaderboard visibility window");
  return typeof data === "string" ? data : null;
}

function campaignIsActive(row: Record<string, unknown> | null, nowMs = Date.now()): boolean {
  if (!row?.starts_at || !row?.proposed_ends_at) return false;
  const s = new Date(String(row.starts_at)).getTime();
  const p = new Date(String(row.proposed_ends_at)).getTime();
  const e = row.ended_at != null ? new Date(String(row.ended_at)).getTime() : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(p)) return false;
  const effectiveEnd = Number.isFinite(e) ? Math.min(e, p) : p;
  return nowMs >= s && nowMs < effectiveEnd;
}

async function loadActiveCampaign() {
  const nowIso = new Date().toISOString();
  // Candidates that have started and whose proposed end is still in the future (ended early filtered in JS).
  const { data, error } = await supabase
    .from("referral_competition_campaigns")
    .select(CAMPAIGN_SELECT)
    .lte("starts_at", nowIso)
    .gt("proposed_ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message || "Failed to load active competition campaign");

  const rows = Array.isArray(data) ? data : [];
  return rows.find((row) => campaignIsActive(row as Record<string, unknown>)) ?? null;
}

async function loadCampaignHistory() {
  const { data, error } = await supabase
    .from("referral_competition_campaigns")
    .select(CAMPAIGN_SELECT)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error(error.message || "Failed to load competition history");
  return Array.isArray(data) ? data : [];
}

/** Record when a competition window closes so the 7-day staff grace period can start. */
export async function syncReferralCompetitionWindowEnd() {
  const { data: row, error } = await supabase
    .from("referral_competition_config")
    .select("competition_enabled, competition_last_ended_at")
    .eq("id", 1)
    .maybeSingle();

  if (error || !row) return;

  const active = await loadReferralCompetitionActive();
  const endedAt = (row as { competition_last_ended_at?: string | null }).competition_last_ended_at ?? null;

  if (active) {
    if (endedAt) {
      await supabase
        .from("referral_competition_config")
        .update({
          competition_last_ended_at: null,
          competition_enabled: true,
          signup_button_enabled: true,
          leaderboard_override_visible: false,
        })
        .eq("id", 1);
    } else {
      await supabase
        .from("referral_competition_config")
        .update({
          competition_enabled: true,
          signup_button_enabled: true,
        })
        .eq("id", 1);
    }
    return;
  }

  await supabase
    .from("referral_competition_config")
    .update({
      competition_enabled: false,
      signup_button_enabled: false,
    })
    .eq("id", 1);

  if (endedAt) return;

  let resolvedEnd = new Date().toISOString();
  const { data: campaignEnd, error: endErr } = await supabase.rpc(
    "referral_competition_latest_campaign_end",
  );
  if (!endErr && typeof campaignEnd === "string" && campaignEnd) {
    resolvedEnd = campaignEnd;
  }

  await supabase
    .from("referral_competition_config")
    .update({ competition_last_ended_at: resolvedEnd })
    .eq("id", 1);
}

async function buildReferralCompetitionPayload() {
  await syncReferralCompetitionWindowEnd();
  const [config, competition_active, leaderboard_visible, leaderboard_visible_until, competition_active_row, competition_history] =
    await Promise.all([
      loadReferralCompetitionConfig(),
      loadReferralCompetitionActive(),
      loadLeaderboardVisible(),
      loadLeaderboardVisibleUntil(),
      loadActiveCampaign(),
      loadCampaignHistory(),
    ]);

  return {
    config,
    competition_active,
    competition_active_row,
    competition_history,
    leaderboard_visible,
    leaderboard_visible_until,
  };
}

export async function runGetReferralCompetitionConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdminOrCashier(req);
  if (gate.res) return gate.res;

  try {
    const payload = await buildReferralCompetitionPayload();
    return respond({ success: true, ...payload }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load referral competition config";
    return respond({ success: false, message: msg }, corsHeaders, 500);
  }
}

/** Leaderboard override only — competition on/off is campaign calendar. */
export async function runUpsertReferralCompetitionConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const body = await req.json().catch(() => ({}));
    const hasLeaderboardToggle =
      typeof (body as { leaderboard_override_visible?: unknown }).leaderboard_override_visible === "boolean";

    if (!hasLeaderboardToggle) {
      return respond(
        {
          success: false,
          message:
            "Competition on/off is controlled by competition campaigns. Use leaderboard_override_visible to show the staff board after grace.",
        },
        corsHeaders,
        400,
      );
    }

    const update: Record<string, unknown> = {
      updated_by: session.user_id,
      leaderboard_override_visible: Boolean(
        (body as { leaderboard_override_visible?: unknown }).leaderboard_override_visible,
      ),
    };

    const { data, error } = await supabase
      .from("referral_competition_config")
      .update(update)
      .eq("id", 1)
      .select(CONFIG_SELECT)
      .single();

    if (error || !data) {
      return respond(
        { success: false, message: error?.message || "Failed to save referral competition config" },
        corsHeaders,
        500,
      );
    }

    const config = mapConfigRow(data as ReferralConfigRow);

    await logAudit({
      supabase,
      event: "REFERRAL_COMPETITION_CONFIG_UPDATED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "REF-CFG-UP",
      metadata: {
        leaderboard_override_visible: config.leaderboard_override_visible,
      },
      req,
    });

    const payload = await buildReferralCompetitionPayload();
    return respond({ success: true, ...payload }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save referral competition config";
    return respond({ success: false, message: msg }, corsHeaders, 500);
  }
}

export async function runUpsertReferralCompetitionCampaign(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof (body as { id?: unknown }).id === "string"
      ? String((body as { id?: string }).id).trim()
      : "";
    const starts_at = asIsoRequired((body as { starts_at?: unknown }).starts_at, "starts_at");
    const proposed_ends_at = asIsoRequired(
      (body as { proposed_ends_at?: unknown }).proposed_ends_at,
      "proposed_ends_at",
    );
    const note = typeof (body as { note?: unknown }).note === "string"
      ? String((body as { note?: string }).note).trim() || null
      : null;

    if (new Date(starts_at).getTime() >= new Date(proposed_ends_at).getTime()) {
      return respond({ success: false, message: "starts_at must be < proposed_ends_at" }, corsHeaders, 400);
    }

    const payload: Record<string, unknown> = {
      starts_at,
      proposed_ends_at,
      note,
      updated_by: session.user_id,
    };
    if (!id) payload.created_by = session.user_id;
    if (id) payload.id = id;

    const { data, error } = await supabase
      .from("referral_competition_campaigns")
      .upsert(payload, { onConflict: "id" })
      .select(CAMPAIGN_SELECT)
      .single();

    if (error || !data) {
      const msg = String(error?.message || "Failed to save competition campaign");
      return respond({ success: false, message: msg }, corsHeaders, 500);
    }

    await logAudit({
      supabase,
      event: "REFERRAL_COMPETITION_CAMPAIGN_UPSERTED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "REF-CAMP-UP",
      metadata: { id: data.id, starts_at: data.starts_at, proposed_ends_at: data.proposed_ends_at },
      req,
    });

    const full = await buildReferralCompetitionPayload();
    return respond({ success: true, campaign: data, ...full }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return respond({ success: false, message: msg }, corsHeaders, 400);
  }
}

export async function runEndReferralCompetitionCampaign(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = typeof (body as { id?: unknown }).id === "string"
    ? String((body as { id?: string }).id).trim()
    : "";
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const { data: existing } = await supabase
    .from("referral_competition_campaigns")
    .select("id, starts_at, proposed_ends_at, ended_at")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("referral_competition_campaigns")
    .update({ ended_at: new Date().toISOString(), updated_by: session.user_id })
    .eq("id", id)
    .is("ended_at", null)
    .select(CAMPAIGN_SELECT)
    .maybeSingle();

  if (error) {
    return respond({ success: false, message: error.message || "Failed to end competition" }, corsHeaders, 500);
  }

  await logAudit({
    supabase,
    event: "REFERRAL_COMPETITION_CAMPAIGN_ENDED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "REF-CAMP-END",
    metadata: { id, prev: existing ?? null },
    req,
  });

  const full = await buildReferralCompetitionPayload();
  return respond({ success: true, campaign: data ?? null, ...full }, corsHeaders, 200);
}

export async function runDeleteScheduledReferralCompetition(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = typeof (body as { id?: unknown }).id === "string"
    ? String((body as { id?: string }).id).trim()
    : "";
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("referral_competition_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return respond({ success: false, message: "Competition campaign not found" }, corsHeaders, 404);
  }

  if (!(existing.starts_at > nowIso) || existing.ended_at != null) {
    return respond(
      { success: false, message: "Only scheduled competitions (not started yet) can be deleted." },
      corsHeaders,
      409,
    );
  }

  const { error } = await supabase
    .from("referral_competition_campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    return respond({ success: false, message: error.message || "Failed to delete competition" }, corsHeaders, 500);
  }

  await logAudit({
    supabase,
    event: "REFERRAL_COMPETITION_CAMPAIGN_DELETED",
    user_id: String(session.user_id),
    channel: "ADMIN",
    actor_user_id: session.user_id,
    success: true,
    severity: "medium",
    diag: "REF-CAMP-DEL",
    metadata: { prev: existing },
    req,
  });

  const full = await buildReferralCompetitionPayload();
  return respond({ success: true, ...full }, corsHeaders, 200);
}

export async function runGetReferralLeaderboard(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdminOrCashier(req);
  if (gate.res) return gate.res;

  const isAdmin = roleIs(gate.session!.role, "admin");

  try {
    await syncReferralCompetitionWindowEnd();
    const leaderboard_visible = await loadLeaderboardVisible();

    if (!leaderboard_visible && !isAdmin) {
      return respond(
        {
          success: false,
          code: "LEADERBOARD_HIDDEN",
          message: "The referral leaderboard is not available right now.",
          leaderboard_visible: false,
        },
        corsHeaders,
        403,
      );
    }

    const { data, error } = await supabase.rpc("referral_competition_leaderboard");
    if (error) {
      return respond({ success: false, message: error.message || "Failed to load leaderboard" }, corsHeaders, 500);
    }

    const leaderboard_visible_until = await loadLeaderboardVisibleUntil();

    return respond(
      {
        success: true,
        leaderboard: data ?? [],
        leaderboard_visible,
        leaderboard_visible_until,
      },
      corsHeaders,
      200,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load leaderboard";
    return respond({ success: false, message: msg }, corsHeaders, 500);
  }
}
