import { useCallback, useEffect, useState } from "react";
import RippleButton from "./RippleButton.jsx";
import ReferralLeaderboardSection from "./ReferralLeaderboardSection.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useToast } from "../contexts/ToastContext.jsx";
import { useModal } from "../contexts/ModalContext.jsx";

function isoDateInputValue(iso) {
  if (!iso) return "";
  try {
    return String(iso).slice(0, 16);
  } catch {
    return "";
  }
}

function campaignStatusForRow(row, nowMs = Date.now()) {
  if (!row) return { key: "unknown", label: "Unknown" };
  const s = row.starts_at ? new Date(row.starts_at).getTime() : NaN;
  const p = row.proposed_ends_at ? new Date(row.proposed_ends_at).getTime() : NaN;
  const e = row.ended_at ? new Date(row.ended_at).getTime() : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(p)) return { key: "unknown", label: "Unknown" };

  const effectiveEnd = Number.isFinite(e) ? Math.min(e, p) : p;

  if (nowMs < s) return { key: "scheduled", label: "Scheduled" };
  if (nowMs >= s && nowMs < effectiveEnd) return { key: "active", label: "Active" };
  if (Number.isFinite(e) && e < p) return { key: "ended_early", label: "Ended early" };
  return { key: "ended", label: "Ended" };
}

function campaignStatusBadgeClass(key) {
  const k = String(key || "");
  if (k === "active") return "bg-emerald-50 text-emerald-800 border-emerald-100";
  if (k === "scheduled") return "bg-blue-50 text-blue-800 border-blue-100";
  if (k === "ended_early") return "bg-amber-50 text-amber-900 border-amber-100";
  if (k === "ended") return "bg-gray-50 text-gray-700 border-gray-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function computeProposedEndAtLocal(startLocal, count, unit) {
  const start = startLocal ? new Date(startLocal) : null;
  const n = Number(count);
  if (!start || Number.isNaN(start.getTime())) return "";
  if (!Number.isFinite(n) || n <= 0) return "";
  const u = String(unit || "days");

  const end = new Date(start);
  if (u === "weeks") {
    end.setDate(end.getDate() + n * 7);
  } else if (u === "months") {
    end.setMonth(end.getMonth() + n);
  } else {
    end.setDate(end.getDate() + n);
  }

  end.setHours(23, 59, 0, 0);
  return isoDateInputValue(end.toISOString());
}

/**
 * Admin Settings: referral competition calendar (independent of billing promo) + leaderboard.
 */
export default function ReferralCompetitionSettingsSection() {
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [history, setHistory] = useState([]);
  const [competitionLive, setCompetitionLive] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [proposedEndsAt, setProposedEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [durationCount, setDurationCount] = useState(14);
  const [durationUnit, setDurationUnit] = useState("days");
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-get-referral-competition-config" },
      });
      if (error || !data?.success) {
        setActiveCampaign(null);
        setHistory([]);
        setCompetitionLive(false);
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to load competition settings.",
        });
        return;
      }
      setActiveCampaign(data.competition_active_row ?? null);
      setHistory(Array.isArray(data.competition_history) ? data.competition_history : []);
      setCompetitionLive(Boolean(data.competition_active));
      setLeaderboardKey((k) => k + 1);
    } catch {
      setActiveCampaign(null);
      setHistory([]);
      setCompetitionLive(false);
      addToast({ type: "error", message: "Failed to load competition settings." });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  function loadIntoEditor(row) {
    setDraftId(String(row?.id || ""));
    setStartsAt(isoDateInputValue(row?.starts_at));
    setProposedEndsAt(isoDateInputValue(row?.proposed_ends_at));
    setNote(row?.note ? String(row.note) : "");
    setEditorOpen(true);
  }

  function clearEditor() {
    setDraftId("");
    setStartsAt(isoDateInputValue(new Date().toISOString()));
    setProposedEndsAt("");
    setNote("");
    setEditorOpen(true);
  }

  function openEditorForActive() {
    if (!activeCampaign?.id) return;
    loadIntoEditor(activeCampaign);
  }

  function openEditorForNewScheduled() {
    let start = new Date();
    if (activeCampaign?.proposed_ends_at) {
      const proposedEndMs = new Date(activeCampaign.proposed_ends_at).getTime();
      const endedMs = activeCampaign.ended_at ? new Date(activeCampaign.ended_at).getTime() : null;
      const effectiveEnd = Number.isFinite(endedMs) ? Math.min(endedMs, proposedEndMs) : proposedEndMs;
      if (Number.isFinite(effectiveEnd)) {
        start = new Date(effectiveEnd);
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
      }
    }
    setDraftId("");
    setStartsAt(isoDateInputValue(start.toISOString()));
    setProposedEndsAt("");
    setNote("");
    setEditorOpen(true);
  }

  async function saveCampaign() {
    if (!startsAt || !proposedEndsAt) {
      addToast({ type: "error", message: "Start and proposed end are required." });
      return;
    }
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(proposedEndsAt).getTime();
    if (!(startMs < endMs)) {
      addToast({ type: "error", message: "Start must be before proposed end." });
      return;
    }

    const editingActive = activeCampaign?.id && String(draftId) === String(activeCampaign.id);
    if (activeCampaign?.starts_at && activeCampaign?.proposed_ends_at && !editingActive) {
      const activeProposedEndMs = new Date(activeCampaign.proposed_ends_at).getTime();
      const activeEndedMs = activeCampaign.ended_at ? new Date(activeCampaign.ended_at).getTime() : null;
      const activeEffectiveEnd = Number.isFinite(activeEndedMs)
        ? Math.min(activeEndedMs, activeProposedEndMs)
        : activeProposedEndMs;
      if (startMs < activeEffectiveEnd) {
        addToast({
          type: "error",
          message: "Scheduled competition start overlaps the running one. Pick a start date after it ends.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: {
          operation: "admin-upsert-referral-competition-campaign",
          id: draftId || null,
          starts_at: new Date(startsAt).toISOString(),
          proposed_ends_at: new Date(proposedEndsAt).toISOString(),
          note: note.trim() || null,
        },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to save competition.",
        });
        return;
      }
      addToast({ type: "success", message: "Competition campaign saved." });
      setEditorOpen(false);
      await load();
    } catch {
      addToast({ type: "error", message: "Failed to save competition." });
    } finally {
      setSaving(false);
    }
  }

  async function endCampaign() {
    if (!activeCampaign?.id) return;
    const ok = await confirm({
      title: "End competition now?",
      message: "This stops referral signup prompts and new attribution immediately. Scores for this window stay on the leaderboard.",
      confirmLabel: "End competition",
      cancelLabel: "Keep running",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-end-referral-competition-campaign", id: activeCampaign.id },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to end competition.",
        });
        return;
      }
      addToast({ type: "success", message: "Competition ended." });
      setEditorOpen(false);
      await load();
    } catch {
      addToast({ type: "error", message: "Failed to end competition." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteScheduled(row) {
    const id = row?.id;
    if (!id) return;
    const ok = await confirm({
      title: "Delete scheduled competition?",
      message: "This permanently removes the scheduled competition.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    try {
      const { data, error } = await invokeWithAuth("admin-api", {
        body: { operation: "admin-delete-scheduled-referral-competition", id },
      });
      if (error || !data?.success) {
        addToast({
          type: "error",
          message: data?.message || error?.message || "Failed to delete competition.",
        });
        return;
      }
      addToast({ type: "success", message: "Scheduled competition deleted." });
      await load();
    } catch {
      addToast({ type: "error", message: "Failed to delete competition." });
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white/90 shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Referral competition
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Independent contest calendar — separate from free-registration promo billing. Schedule windows,
            end early, and review past competitions. Leaderboard ranks referred signups in those windows;
            ties break on referred users with 2+ registered items.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-xl border bg-white text-sm"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            Refresh
          </RippleButton>
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-xl border bg-white text-sm"
            onClick={activeCampaign?.id ? openEditorForNewScheduled : clearEditor}
            disabled={loading || saving}
            title={
              activeCampaign?.id
                ? "Schedule a new competition after the current one"
                : "Create a new competition"
            }
          >
            {activeCampaign?.id ? "Schedule next" : "New competition"}
          </RippleButton>
          {activeCampaign?.id ? (
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-xl border bg-white text-sm"
              onClick={openEditorForActive}
              disabled={loading || saving}
            >
              Edit active
            </RippleButton>
          ) : null}
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm disabled:opacity-60"
            onClick={() => void saveCampaign()}
            disabled={loading || saving}
          >
            {saving ? "Saving…" : "Save"}
          </RippleButton>
          {activeCampaign?.id ? (
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm disabled:opacity-60"
              onClick={() => void endCampaign()}
              disabled={loading || saving}
            >
              End now
            </RippleButton>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
      </div>

      {editorOpen ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Start</label>
              <input
                type="datetime-local"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Proposed end</label>
              <input
                type="datetime-local"
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                value={proposedEndsAt}
                onChange={(e) => setProposedEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Quick duration
            </div>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-600">Length</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  value={durationCount}
                  onChange={(e) => setDurationCount(Number(e.target.value))}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-600">Unit</label>
                <select
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value)}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
              <RippleButton
                type="button"
                className="px-4 py-2 rounded-xl border bg-white text-sm"
                onClick={() =>
                  setProposedEndsAt(computeProposedEndAtLocal(startsAt, durationCount, durationUnit))
                }
                disabled={!startsAt}
              >
                Set end
              </RippleButton>
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              Sets proposed end to 23:59 on the ending day. You can still edit it.
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600">Note (optional)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Q3 agent contest"
            />
          </div>
          {activeCampaign?.ended_at && String(draftId) === String(activeCampaign.id) ? (
            <div className="text-xs text-gray-500">
              Actual end: {new Date(activeCampaign.ended_at).toLocaleString()}
            </div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm text-gray-700 hover:underline"
              onClick={() => setEditorOpen(false)}
            >
              Hide editor
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
          {activeCampaign?.id ? (
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-800">Active competition running</div>
                <div className="text-xs text-gray-600 mt-1">
                  Start:{" "}
                  <span className="font-medium">
                    {activeCampaign.starts_at
                      ? new Date(activeCampaign.starts_at).toLocaleString()
                      : "—"}
                  </span>
                  <span className="mx-2 text-gray-300">|</span>
                  Proposed end:{" "}
                  <span className="font-medium">
                    {activeCampaign.proposed_ends_at
                      ? new Date(activeCampaign.proposed_ends_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
                {activeCampaign.note ? (
                  <div className="text-xs text-gray-600 mt-1 truncate">
                    <span className="font-medium">Note:</span> {activeCampaign.note}
                  </div>
                ) : null}
              </div>
              <div className="text-xs text-gray-500">
                Use <span className="font-medium">Edit active</span> to change dates, or{" "}
                <span className="font-medium">End now</span> to stop early.
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700">
              No active competition. Click <span className="font-medium">New competition</span> to create
              one.
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Recent competition history</h3>
          <p className="text-xs text-gray-500">Last 5 saved competition windows.</p>
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500">No history yet.</div>
        ) : (
          <>
            <div className="divide-y rounded-xl border border-gray-100 overflow-hidden lg:hidden">
              {history.map((h) => {
                const st = campaignStatusForRow(h);
                const isScheduled = st.key === "scheduled";
                return (
                  <div key={h.id} className="px-4 py-3 bg-gray-50/40">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm font-medium text-gray-800">Competition</div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${campaignStatusBadgeClass(
                          st.key,
                        )}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Saved: {h.created_at ? new Date(h.created_at).toLocaleString() : "—"}
                    </div>
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <div>
                        <span className="font-medium">Start:</span>{" "}
                        {h.starts_at ? new Date(h.starts_at).toLocaleString() : "—"}
                      </div>
                      <div>
                        <span className="font-medium">Proposed end:</span>{" "}
                        {h.proposed_ends_at ? new Date(h.proposed_ends_at).toLocaleString() : "—"}
                      </div>
                      <div>
                        <span className="font-medium">Actual end:</span>{" "}
                        {h.ended_at ? new Date(h.ended_at).toLocaleString() : "—"}
                      </div>
                      {h.note ? (
                        <div className="truncate">
                          <span className="font-medium">Note:</span> {h.note}
                        </div>
                      ) : null}
                    </div>
                    {isScheduled ? (
                      <div className="mt-3 flex items-center gap-4">
                        <button
                          type="button"
                          className="text-sm text-gray-700 hover:underline"
                          onClick={() => loadIntoEditor(h)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-sm text-red-700 hover:underline"
                          onClick={() => void deleteScheduled(h)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block overflow-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Start</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">
                      Proposed end
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">
                      Actual end
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Note</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {history.map((h) => {
                    const st = campaignStatusForRow(h);
                    const isScheduled = st.key === "scheduled";
                    return (
                      <tr key={h.id}>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${campaignStatusBadgeClass(
                              st.key,
                            )}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {h.starts_at ? new Date(h.starts_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {h.proposed_ends_at ? new Date(h.proposed_ends_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {h.ended_at ? new Date(h.ended_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[26rem] truncate">
                          {h.note || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isScheduled ? (
                            <div className="inline-flex items-center gap-4 justify-end">
                              <button
                                type="button"
                                className="text-sm text-gray-700 hover:underline"
                                onClick={() => loadIntoEditor(h)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-sm text-red-700 hover:underline"
                                onClick={() => void deleteScheduled(h)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <ReferralLeaderboardSection key={leaderboardKey} manageConfig />
      </div>
    </section>
  );
}
