import { useEffect, useMemo, useState } from "react";
import { Tag, RefreshCw } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";

export default function PricingPage({ title = "Pricing", subtitle = "Credit cost per task" } = {}) {
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-iregistrygreen" />
            {title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <RippleButton
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </RippleButton>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : activeTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
          No pricing configured yet.
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Task</th>
                <th className="text-left font-semibold px-4 py-3">Description</th>
                <th className="text-right font-semibold px-4 py-3">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y">
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
      )}

      {inactiveTasks.length > 0 ? (
        <div className="text-xs text-gray-400">
          {inactiveTasks.length} inactive task(s) hidden.
        </div>
      ) : null}
    </div>
  );
}

