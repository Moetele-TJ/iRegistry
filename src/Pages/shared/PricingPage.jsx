import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import PricingPageShell from "./PricingPageShell.jsx";

/** Optional `topUpTo` adds a Top-up link in the card header (pass role-specific path). */
export default function PricingPage({
  title = "Pricing",
  subtitle = "Credit cost per task",
  topUpTo,
} = {}) {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-tasks");
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load pricing");
      setTasks(data.tasks || []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load pricing" });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTasks = useMemo(() => (tasks || []).filter((t) => t?.active), [tasks]);
  const inactiveTasks = useMemo(() => (tasks || []).filter((t) => !t?.active), [tasks]);

  const headerActions = (
    <>
      {topUpTo ? (
        <Link
          to={topUpTo}
          className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white/90 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm hover:bg-white transition"
        >
          Top-up
        </Link>
      ) : null}
      <RippleButton
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
        onClick={() => void load()}
        disabled={loading}
      >
        <RefreshCw size={16} />
        Refresh
      </RippleButton>
    </>
  );

  const body = loading ? (
    <div className="px-5 py-6 text-sm text-gray-500">Loading…</div>
  ) : activeTasks.length === 0 ? (
    <div className="px-5 py-6 text-sm text-gray-500">No pricing configured yet.</div>
  ) : (
    <>
      {/* Mobile: stacked cards (match Transactions page) */}
      <div className="md:hidden px-4 pb-4 sm:px-5 space-y-3">
        {activeTasks.map((t) => (
          <article
            key={t.code}
            className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</p>
                <p className="text-sm text-gray-900 font-medium mt-0.5 break-words">{t.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">{t.code}</p>
              </div>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100 tabular-nums shrink-0">
                {Number(t.credits_cost ?? 0)}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-800 mt-0.5 break-words">{t.description || "—"}</p>
            </div>
          </article>
        ))}
      </div>

      {/* md+: table */}
      <div className="hidden md:block overflow-x-auto px-4 sm:px-5">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Task</th>
              <th className="text-left font-semibold px-4 py-3">Description</th>
              <th className="text-right font-semibold px-4 py-3">Credits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeTasks.map((t) => (
              <tr key={t.code} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{t.code}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">{t.description || "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                  {Number(t.credits_cost ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const footer =
    inactiveTasks.length > 0 ? (
      <div className="text-xs text-gray-400">
        {inactiveTasks.length} inactive task(s) hidden.
      </div>
    ) : null;

  return (
    <PricingPageShell title={title} subtitle={subtitle} actions={headerActions} footer={footer}>
      {body}
    </PricingPageShell>
  );
}
