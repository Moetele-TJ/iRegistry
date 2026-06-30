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

type ReferralConfigRow = {
  competition_enabled?: boolean;
  signup_button_enabled?: boolean;
  competition_last_ended_at?: string | null;
  leaderboard_override_visible?: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
};

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

async function loadSystemPromoActive() {
  const { data, error } = await supabase.rpc("is_promo_active", { p_user_id: null });
  if (error) throw new Error(error.message || "Failed to load promotion status");
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
  const competitionEnabled = Boolean((row as { competition_enabled?: boolean }).competition_enabled);

  if (active) {
    if (endedAt) {
      await supabase
        .from("referral_competition_config")
        .update({ competition_last_ended_at: null })
        .eq("id", 1);
    }
    return;
  }

  if (endedAt) return;

  let resolvedEnd = new Date().toISOString();
  if (competitionEnabled) {
    const { data: promoEnd, error: promoErr } = await supabase.rpc(
      "referral_competition_latest_system_promo_end",
    );
    if (!promoErr && typeof promoEnd === "string" && promoEnd) {
      resolvedEnd = promoEnd;
    }
  }

  await supabase
    .from("referral_competition_config")
    .update({ competition_last_ended_at: resolvedEnd })
    .eq("id", 1);
}

async function buildReferralCompetitionPayload() {
  await syncReferralCompetitionWindowEnd();
  const config = await loadReferralCompetitionConfig();
  const [competition_active, promo_active, leaderboard_visible, leaderboard_visible_until] = await Promise.all([
    loadReferralCompetitionActive(),
    loadSystemPromoActive(),
    loadLeaderboardVisible(),
    loadLeaderboardVisibleUntil(),
  ]);

  return {
    config,
    competition_active,
    promo_active,
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

export async function runUpsertReferralCompetitionConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const body = await req.json().catch(() => ({}));
    const hasCompetitionToggle =
      typeof (body as { competition_enabled?: unknown }).competition_enabled === "boolean"
      || typeof (body as { signup_button_enabled?: unknown }).signup_button_enabled === "boolean";
    const hasLeaderboardToggle =
      typeof (body as { leaderboard_override_visible?: unknown }).leaderboard_override_visible === "boolean";

    if (!hasCompetitionToggle && !hasLeaderboardToggle) {
      return respond(
        { success: false, message: "No referral competition fields to update." },
        corsHeaders,
        400,
      );
    }

    const update: Record<string, unknown> = { updated_by: session.user_id };

    if (hasCompetitionToggle) {
      const enabled = Boolean(
        (body as { competition_enabled?: unknown }).competition_enabled
        ?? (body as { signup_button_enabled?: unknown }).signup_button_enabled,
      );
      update.competition_enabled = enabled;
      update.signup_button_enabled = enabled;
      if (enabled) {
        update.competition_last_ended_at = null;
        update.leaderboard_override_visible = false;
      } else {
        update.competition_last_ended_at = new Date().toISOString();
      }
    }

    if (hasLeaderboardToggle) {
      update.leaderboard_override_visible = Boolean(
        (body as { leaderboard_override_visible?: unknown }).leaderboard_override_visible,
      );
    }

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
        competition_enabled: config.competition_enabled,
        signup_button_enabled: config.signup_button_enabled,
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
