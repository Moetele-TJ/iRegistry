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

const CONFIG_SELECT = "signup_button_enabled, updated_at, updated_by";

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

export async function loadReferralCompetitionConfig() {
  const { data, error } = await supabase
    .from("referral_competition_config")
    .select(CONFIG_SELECT)
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Failed to load referral competition config");

  return {
    signup_button_enabled: Boolean((data as { signup_button_enabled?: boolean } | null)?.signup_button_enabled),
    updated_at: (data as { updated_at?: string } | null)?.updated_at ?? null,
    updated_by: (data as { updated_by?: string } | null)?.updated_by ?? null,
  };
}

export async function runGetReferralCompetitionConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;

  try {
    const config = await loadReferralCompetitionConfig();
    return respond({ success: true, config }, corsHeaders, 200);
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
    const enabled = Boolean((body as { signup_button_enabled?: unknown })?.signup_button_enabled);

    const { data, error } = await supabase
      .from("referral_competition_config")
      .update({
        signup_button_enabled: enabled,
        updated_by: session.user_id,
      })
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

    const config = {
      signup_button_enabled: Boolean((data as { signup_button_enabled?: boolean }).signup_button_enabled),
      updated_at: (data as { updated_at?: string }).updated_at ?? null,
      updated_by: (data as { updated_by?: string }).updated_by ?? null,
    };

    await logAudit({
      supabase,
      event: "REFERRAL_COMPETITION_CONFIG_UPDATED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "REF-CFG-UP",
      metadata: { signup_button_enabled: config.signup_button_enabled },
      req,
    });

    return respond({ success: true, config }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save referral competition config";
    return respond({ success: false, message: msg }, corsHeaders, 500);
  }
}

export async function runGetReferralLeaderboard(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;

  try {
    const { data, error } = await supabase.rpc("referral_competition_leaderboard");
    if (error) {
      return respond({ success: false, message: error.message || "Failed to load leaderboard" }, corsHeaders, 500);
    }

    return respond({ success: true, leaderboard: data ?? [] }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load leaderboard";
    return respond({ success: false, message: msg }, corsHeaders, 500);
  }
}
