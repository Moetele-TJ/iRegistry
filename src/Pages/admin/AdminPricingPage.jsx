import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Tag, RefreshCw } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar.jsx";

export default function AdminPricingPage() {
  useAdminSidebar();
  const { addToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    credits_cost: 0,
    active: true,
  });

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-tasks");
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load tasks");
      setTasks(data.tasks || []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load tasks" });
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

  function startNew() {
    setForm({ code: "", name: "", description: "", credits_cost: 0, active: true });
  }

  function startEdit(t) {
    setForm({
      code: t.code || "",
      name: t.name || "",
      description: t.description || "",
      credits_cost: Number(t.credits_cost ?? 0),
      active: !!t.active,
    });
  }

  async function save() {
    const payload = {
      code: String(form.code || "").trim(),
      name: String(form.name || "").trim(),
      description: String(form.description || "").trim() || null,
      credits_cost: Number(form.credits_cost),
      active: !!form.active,
    };
    if (!payload.code || !payload.name) {
      addToast({ type: "error", message: "Code and name are required." });
      return;
    }
    if (!Number.isFinite(payload.credits_cost) || payload.credits_cost < 0) {
      addToast({ type: "error", message: "Credits cost must be a number >= 0." });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-upsert-task", { body: payload });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to save task");
      addToast({ type: "success", message: "Task saved." });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to save task" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-iregistrygreen" />
            Pricing & tasks
          </h1>
          <p className="text-sm text-gray-500 mt-1">View and manage credit costs per task.</p>
        </div>
        <div className="flex items-center gap-2">
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm"
            onClick={startNew}
          >
            <Plus size={16} />
            New task
          </RippleButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">Current tasks</div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="space-y-6">
              <TaskTable title="Active" tasks={activeTasks} onEdit={startEdit} />
              {inactiveTasks.length > 0 ? (
                <TaskTable title="Inactive" tasks={inactiveTasks} onEdit={startEdit} />
              ) : null}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="text-sm font-semibold text-gray-800">Add / edit task</div>

          <div>
            <label className="text-xs text-gray-600">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-mono"
              placeholder="e.g. ADD_ITEM"
            />
            <p className="text-xs text-gray-400 mt-1">Uppercase letters, numbers, underscore.</p>
          </div>

          <div>
            <label className="text-xs text-gray-600">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Display name"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[90px]"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Credits cost</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.credits_cost}
                onChange={(e) => setForm((f) => ({ ...f, credits_cost: Number(e.target.value) }))} 
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="accent-emerald-600"
                />
                Active
              </label>
            </div>
          </div>

          <RippleButton
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            onClick={() => void save()}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Saving…" : "Save task"}
          </RippleButton>
        </section>
      </div>
    </div>
  );
}

function TaskTable({ title, tasks, onEdit }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</div>
      {tasks.length === 0 ? (
        <div className="text-sm text-gray-500">None.</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Task</th>
                <th className="text-right font-semibold px-4 py-3">Credits</th>
                <th className="text-right font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((t) => (
                <tr key={t.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{t.code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(t.credits_cost ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <RippleButton className="px-3 py-2 rounded-xl border bg-white text-sm" onClick={() => onEdit(t)}>
                      Edit
                    </RippleButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

