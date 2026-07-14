import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { respond } from "./respond.ts";
import { roleIs } from "./roles.ts";
import { logUserActivity } from "./logUserActivity.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type Session = { user_id: string; role: string };

export type ReferralStats = {
  signup_count: number;
  qualified_count: number;
};

export async function fetchReferralStatsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReferralStats> {
  const { data: counts, error } = await supabase.rpc("referral_counts_for_agent", {
    p_agent_user_id: userId,
  });
  if (error) throw new Error(error.message || "Failed to load referral stats");

  const row = Array.isArray(counts) ? counts[0] : counts;
  const signup_count = Number((row as { signup_count?: unknown })?.signup_count ?? 0);
  const qualified_count = Number((row as { qualified_count?: unknown })?.qualified_count ?? 0);

  return {
    signup_count: Number.isFinite(signup_count) ? signup_count : 0,
    qualified_count: Number.isFinite(qualified_count) ? qualified_count : 0,
  };
}

export async function buildReferralPersonalBlock(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: userRow } = await supabase
    .from("users")
    .select("agent_number, agent_number_assigned_at")
    .eq("id", userId)
    .maybeSingle();

  const agent_number = userRow?.agent_number ? String(userRow.agent_number) : null;
  if (!agent_number) {
    return { agent_number: null, assigned_at: null, stats: { signup_count: 0, qualified_count: 0 } };
  }

  const stats = await fetchReferralStatsForUser(supabase, userId);
  return {
    agent_number,
    assigned_at: userRow?.agent_number_assigned_at ?? null,
    stats,
  };
}

export async function handleGetReferralStats(
  supabase: SupabaseClient,
  session: Session,
  corsHeaders: Record<string, string>,
) {
  if (!roleIs(session.role, "user")) {
    return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("agent_number, agent_number_assigned_at")
    .eq("id", session.user_id)
    .maybeSingle();

  const agent_number = userRow?.agent_number ? String(userRow.agent_number) : null;
  const stats = agent_number
    ? await fetchReferralStatsForUser(supabase, session.user_id)
    : { signup_count: 0, qualified_count: 0 };

  return respond(
    {
      success: true,
      agent_number,
      assigned_at: userRow?.agent_number_assigned_at ?? null,
      stats,
    },
    corsHeaders,
    200,
  );
}

export async function handleClaimReferralCode(
  supabase: SupabaseClient,
  session: Session,
  corsHeaders: Record<string, string>,
) {
  if (!roleIs(session.role, "user")) {
    return respond(
      { success: false, message: "Only standard user accounts can claim a referral code." },
      corsHeaders,
      403,
    );
  }

  const { data: competitionActive, error: competitionErr } = await supabase.rpc(
    "is_referral_competition_active",
  );
  if (competitionErr) {
    console.error("claim-referral-code competition check:", competitionErr.message);
  }
  if (!competitionActive) {
    return respond(
      { success: false, message: "The referral competition is not open right now." },
      corsHeaders,
      403,
    );
  }

  const { data: agentNumber, error: assignErr } = await supabase.rpc(
    "assign_agent_number_to_user",
    { p_user_id: session.user_id },
  );

  if (assignErr || !agentNumber) {
    return respond(
      { success: false, message: assignErr?.message || "Failed to assign referral code." },
      corsHeaders,
      500,
    );
  }

  const stats = await fetchReferralStatsForUser(supabase, session.user_id);

  const { data: userRow } = await supabase
    .from("users")
    .select("first_name, last_name, email, agent_number_assigned_at")
    .eq("id", session.user_id)
    .maybeSingle();

  const displayName =
    [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ").trim() ||
    String(userRow?.email || "").trim() ||
    "User";

  await logUserActivity(supabase, {
    actorId: session.user_id,
    actorRole: String(session.role || "user"),
    targetUserId: session.user_id,
    targetDisplayName: displayName,
    action: "REFERRAL_CODE_CLAIMED",
    message: `Referral code ${String(agentNumber)} claimed.`,
    metadata: { agent_number: String(agentNumber) },
  });

  return respond(
    {
      success: true,
      agent_number: String(agentNumber),
      assigned_at: userRow?.agent_number_assigned_at ?? null,
      stats,
    },
    corsHeaders,
    200,
  );
}
