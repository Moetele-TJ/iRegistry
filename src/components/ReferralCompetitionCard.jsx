import { useCallback, useEffect, useState } from "react";
import { Copy, Gift, RefreshCw } from "lucide-react";
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
  const showCard = Boolean(user?.referral_signup_button_enabled && user?.promo_active);

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
      if (error || !data?.success) return;
      setStats({
        signup_count: Number(data?.stats?.signup_count) || 0,
        qualified_count: Number(data?.stats?.qualified_count) || 0,
      });
    } finally {
      setLoadingStats(false);
    }
  }, [agentNumber]);

  useEffect(() => {
    if (!initialReferral?.stats) return;
    setStats({
      signup_count: Number(initialReferral.stats.signup_count) || 0,
      qualified_count: Number(initialReferral.stats.qualified_count) || 0,
    });
  }, [initialReferral]);

  useEffect(() => {
    if (!showCard || !agentNumber) return;
    if (initialReferral?.stats) return;
    void loadStats();
  }, [showCard, agentNumber, loadStats, initialReferral]);

  if (!showCard) return null;

  async function handleClaim() {
    const ok = await confirm({
      title: "Join the referral competition?",
      message:
        "You will receive a personal referral code (e.g. IR-1001). Share it when helping others sign up. " +
        "At the end of the promotion, the participant with the most active referred signups wins — " +
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
  }

  async function copyCode() {
    if (!agentNumber) return;
    try {
      await navigator.clipboard.writeText(agentNumber);
      addToast({ type: "success", message: "Referral code copied." });
    } catch {
      addToast({ type: "error", message: "Could not copy to clipboard." });
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-6 py-5 border-b border-emerald-100/80">
        <div className="rounded-xl bg-emerald-100 text-emerald-700 p-2.5 shrink-0">
          <Gift size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Referral competition</h2>
          <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">
            Help others register and enter their referral code on signup. Top referrer wins a hamper at promo end.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {!agentNumber ? (
          <>
            <p className="text-sm text-gray-600">
              Opt in to receive your unique code. Only participants who claim a code can earn referral credit.
            </p>
            <button
              type="button"
              onClick={() => void handleClaim()}
              disabled={claiming}
              className="inline-flex items-center justify-center rounded-xl bg-iregistrygreen px-5 py-2.5 text-sm font-semibold text-white hover:shadow-md transition disabled:opacity-60"
            >
              {claiming ? "Assigning…" : "Get a referral code"}
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Your referral code</div>
                <div className="text-2xl font-bold text-iregistrygreen tabular-nums mt-0.5">{agentNumber}</div>
              </div>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-emerald-50"
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

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Referred signups</div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {loadingStats ? "—" : stats.signup_count}
                </div>
                <div className="text-xs text-gray-500 mt-1">Active users during promo</div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Tie-break score</div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {loadingStats ? "—" : stats.qualified_count}
                </div>
                <div className="text-xs text-gray-500 mt-1">Referred users with 2+ items</div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Ask new users to enter your code on the signup form. Codes like IR1001, ir-1001, and IR-1001 all work.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
