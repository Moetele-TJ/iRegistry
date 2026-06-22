import { useCallback, useEffect, useState } from "react";
import { Copy, Gift, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

export default function ReferralCompetitionCard({ initialReferral = null } = {}) {
  const { user, refreshUser } = useAuth();
  const { confirm } = useModal();
  const { addToast } = useToast();

  const [stats, setStats] = useState(() => ({
    signup_count: Number(initialReferral?.stats?.signup_count) || 0,
    qualified_count: Number(initialReferral?.stats?.qualified_count) || 0,
  }));
  const [loadingStats, setLoadingStats] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const agentNumber = user?.agent_number ? String(user.agent_number) : null;
  const showCard = Boolean(
    user?.referral_competition_active
    && (agentNumber || user?.referral_signup_button_enabled),
  );

  const loadStats = useCallback(async () => {
    if (!agentNumber) {
      setStats({ signup_count: 0, qualified_count: 0 });
      return;
    }
    setLoadingStats(true);
    try {
      const { data, error } = await invokeWithAuth("get-dashboard-data", {
        body: { operation: "get-referral-stats" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load referral stats");
      }
      setStats({
        signup_count: Number(data?.stats?.signup_count) || 0,
        qualified_count: Number(data?.stats?.qualified_count) || 0,
      });
    } catch (err) {
      addToast({ type: "error", message: err?.message || "Failed to load referral stats" });
    } finally {
      setLoadingStats(false);
    }
  }, [agentNumber, addToast]);

  const handleClaim = useCallback(async () => {
    const ok = await confirm({
      title: "Join the referral competition?",
      message:
        "You will receive a personal referral code (e.g. IR-1001). Share it when helping others sign up. " +
        "The participant with the most referred signups wins — " +
        "ties are broken by referred users who registered at least 2 items.",
      confirmLabel: "Get my code",
      cancelLabel: "Not now",
    });
    if (!ok) return;

    setClaiming(true);
    try {
      const { data, error } = await invokeWithAuth("get-dashboard-data", {
        body: { operation: "claim-referral-code" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to claim referral code");
      }
      setStats({
        signup_count: Number(data?.stats?.signup_count) || 0,
        qualified_count: Number(data?.stats?.qualified_count) || 0,
      });
      await refreshUser();
      addToast({ type: "success", message: `Your referral code is ${data.agent_number}.` });
    } catch (err) {
      addToast({ type: "error", message: err?.message || "Failed to claim referral code" });
    } finally {
      setClaiming(false);
    }
  }, [addToast, confirm, refreshUser]);

  const copyCode = useCallback(async () => {
    if (!agentNumber) return;
    try {
      await navigator.clipboard.writeText(agentNumber);
      addToast({ type: "success", message: "Referral code copied." });
    } catch {
      addToast({ type: "error", message: "Could not copy to clipboard." });
    }
  }, [addToast, agentNumber]);

  useEffect(() => {
    if (initialReferral == null || loadingStats) return;
    setStats({
      signup_count: Number(initialReferral.stats?.signup_count) || 0,
      qualified_count: Number(initialReferral.stats?.qualified_count) || 0,
    });
  }, [initialReferral, loadingStats]);

  useEffect(() => {
    if (!showCard || !agentNumber) return;
    if (initialReferral != null) return;
    void loadStats();
  }, [showCard, agentNumber, loadStats, initialReferral]);

  if (!showCard) return null;

  return (
    <div className="relative rounded-2xl border-2 border-red-500 bg-white shadow-lg shadow-red-200/60 overflow-hidden ring-1 ring-red-400/30">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-amber-400 to-red-500" aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-3 px-5 sm:px-6 py-5 bg-gradient-to-br from-red-50 via-amber-50/80 to-white border-b border-red-100">
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white p-3 shrink-0 shadow-md shadow-red-300/50">
            <Gift size={22} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Referral competition</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                <Sparkles size={11} />
                Live promo
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              Help others signup and register at least 2 items. Top referrer wins a share of{" "}
              <span className="font-bold text-red-700">P1,000</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm shrink-0">
          <Trophy size={18} className="text-amber-600 shrink-0" />
          <div className="text-xs leading-tight">
            <div className="font-semibold uppercase tracking-wide text-amber-800">Prize pool</div>
            <div className="text-sm font-bold tabular-nums">P1,000</div>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-4 bg-gradient-to-b from-white to-red-50/20">
        {!agentNumber ? (
          <>
            <p className="text-sm text-gray-700 leading-relaxed">
              Opt in to get your unique code. Only participants who claim a code can earn referral credit toward the
              prize.
            </p>
            <button
              type="button"
              onClick={() => void handleClaim()}
              disabled={claiming}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-300/50 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 hover:shadow-lg transition disabled:opacity-60"
            >
              <Sparkles size={16} />
              {claiming ? "Assigning your code…" : "Get a referral code"}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl border-2 border-dashed border-red-300 bg-red-50/60 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Your referral code</div>
                  <div className="text-3xl font-extrabold text-red-600 tabular-nums mt-1 tracking-tight">
                    {agentNumber}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 shadow-sm"
                  >
                    <Copy size={15} />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadStats()}
                    disabled={loadingStats}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                    title="Refresh counts"
                  >
                    <RefreshCw size={15} className={loadingStats ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-100 bg-white px-4 py-3 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Referred signups</div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {loadingStats ? "—" : stats.signup_count}
                </div>
                <div className="text-xs text-gray-500 mt-1">Active users during promo</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 shadow-sm">
                <div className="text-xs font-medium text-amber-800 uppercase tracking-wide">Tie-break score</div>
                <div className="text-2xl font-bold text-amber-900 tabular-nums mt-1">
                  {loadingStats ? "—" : stats.qualified_count}
                </div>
                <div className="text-xs text-amber-800/80 mt-1">Referred users with 2+ items</div>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Ask new users you refer to enter your code on the signup form. Formats like IR1001 and ir-1001 also work.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
