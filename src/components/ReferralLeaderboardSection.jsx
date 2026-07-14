import { useCallback, useEffect, useState } from "react";
import RippleButton from "./RippleButton.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useToast } from "../contexts/ToastContext.jsx";

function participantLabel(row) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim()
    || row?.email
    || row?.user_id
    || "—"
  );
}

function formatVisibleUntil(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

/**
 * Referral competition status + leaderboard (read-only for staff; optional admin override control).
 * Competition calendar is managed separately in Admin Settings.
 */
export default function ReferralLeaderboardSection({
  manageConfig = false,
  maxRows = 20,
  className = "",
  onVisibilityChange,
}) {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [competitionLive, setCompetitionLive] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardVisibleUntil, setLeaderboardVisibleUntil] = useState(null);
  const [leaderboardOverride, setLeaderboardOverride] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, boardRes] = await Promise.all([
        invokeWithAuth("admin-api", { body: { operation: "admin-get-referral-competition-config" } }),
        invokeWithAuth("admin-api", { body: { operation: "admin-get-referral-leaderboard" } }),
      ]);

      let visible = false;
      let visibleUntil = null;

      if (configRes.error || !configRes.data?.success) {
        setCompetitionLive(false);
        setLeaderboardOverride(false);
      } else {
        setCompetitionLive(Boolean(configRes.data?.competition_active));
        setLeaderboardOverride(Boolean(configRes.data?.config?.leaderboard_override_visible));
        visible = Boolean(configRes.data?.leaderboard_visible);
        visibleUntil = configRes.data?.leaderboard_visible_until ?? null;
        setLeaderboardVisible(visible);
        setLeaderboardVisibleUntil(visibleUntil);
      }

      if (boardRes.error || !boardRes.data?.success) {
        setLeaderboard([]);
        if (boardRes.data?.code === "LEADERBOARD_HIDDEN") {
          setLeaderboardVisible(false);
          visible = false;
        }
      } else {
        setLeaderboard(Array.isArray(boardRes.data?.leaderboard) ? boardRes.data.leaderboard : []);
        if (typeof boardRes.data?.leaderboard_visible === "boolean") {
          visible = boardRes.data.leaderboard_visible;
          setLeaderboardVisible(visible);
        }
        if (boardRes.data?.leaderboard_visible_until !== undefined) {
          visibleUntil = boardRes.data.leaderboard_visible_until ?? null;
          setLeaderboardVisibleUntil(visibleUntil);
        }
      }

      onVisibilityChange?.(visible);
    } catch {
      setCompetitionLive(false);
      setLeaderboardOverride(false);
      setLeaderboardVisible(false);
      setLeaderboardVisibleUntil(null);
      setLeaderboard([]);
      onVisibilityChange?.(false);
    } finally {
      setLoading(false);
    }
  }, [onVisibilityChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLeaderboardOverride(enabled) {
    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: {
          operation: "admin-upsert-referral-competition-config",
          leaderboard_override_visible: enabled,
        },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to update leaderboard visibility",
        });
        return;
      }
      setLeaderboardOverride(Boolean(data?.config?.leaderboard_override_visible));
      setLeaderboardVisible(Boolean(data?.leaderboard_visible));
      setLeaderboardVisibleUntil(data?.leaderboard_visible_until ?? null);
      onVisibilityChange?.(Boolean(data?.leaderboard_visible));
      addToast({
        type: "success",
        message: enabled ? "Leaderboard is now visible to staff." : "Leaderboard hidden from staff.",
      });
      await load();
    } catch {
      addToast({ type: "error", message: "Failed to update leaderboard visibility" });
    } finally {
      setSaving(false);
    }
  }

  if (!manageConfig && !loading && !leaderboardVisible) {
    return null;
  }

  const visibleUntilLabel = formatVisibleUntil(leaderboardVisibleUntil);
  const staffVisibilityNote = competitionLive
    ? "Leaderboard is visible to staff while the competition runs."
    : leaderboardVisible && visibleUntilLabel
      ? `Leaderboard visible to staff until ${visibleUntilLabel}.`
      : leaderboardVisible && leaderboardOverride
        ? "Leaderboard is visible to staff by admin override."
        : "Leaderboard is hidden from staff.";

  return (
    <section className={`space-y-4 ${className}`.trim()}>
      {!manageConfig ? (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Referral competition
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Leaderboard ranks referred signups during competition windows, with ties broken on referred
              users with 2+ registered items.
            </p>
          </div>
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-xl border bg-white text-sm"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            Refresh
          </RippleButton>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Leaderboard &amp; staff visibility</h3>
            <p className="text-xs text-gray-500 mt-1">
              Staff can view standings during a live competition and for 7 days after it ends. After that,
              use the override below.
            </p>
          </div>
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-xl border bg-white text-sm"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            Refresh board
          </RippleButton>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!manageConfig ? (
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              competitionLive
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-gray-100 text-gray-600 border border-gray-200",
            ].join(" ")}
          >
            Competition {competitionLive ? "live" : "inactive"}
          </span>
        ) : null}
        <span
          className={[
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            leaderboardVisible
              ? "bg-amber-50 text-amber-900 border border-amber-200"
              : "bg-gray-100 text-gray-600 border border-gray-200",
          ].join(" ")}
        >
          Staff leaderboard {leaderboardVisible ? "visible" : "hidden"}
        </span>
      </div>

      {manageConfig ? (
        <p className="text-xs text-gray-600 leading-relaxed rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
          {staffVisibilityNote}
        </p>
      ) : null}

      {manageConfig ? (
        <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-800">Show leaderboard to staff</div>
            <div className="text-xs text-gray-500 mt-0.5">
              After the 7-day post-competition window, cashiers no longer see standings unless you turn this
              on. Turning it off hides the page from cashiers again.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={leaderboardOverride}
            disabled={loading || saving || competitionLive}
            onClick={() => void saveLeaderboardOverride(!leaderboardOverride)}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 rounded-full transition",
              leaderboardOverride ? "bg-emerald-600" : "bg-gray-300",
              loading || saving || competitionLive ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-1",
                leaderboardOverride ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>
        </label>
      ) : null}

      {(manageConfig || leaderboardVisible) ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Leaderboard</h3>
          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-sm text-gray-400">No participants with referral codes yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Participant</th>
                    <th className="px-3 py-2 font-medium text-right">Signups</th>
                    <th className="px-3 py-2 font-medium text-right">Tie-break</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, maxRows).map((row, idx) => (
                    <tr key={row?.user_id || idx} className="border-t border-gray-100">
                      <td className="px-3 py-2 tabular-nums text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-iregistrygreen tabular-nums">
                        {row?.agent_number || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-800">{participantLabel(row)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{row?.signup_count ?? 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                        {row?.qualified_count ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
