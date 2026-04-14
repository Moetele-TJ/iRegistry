import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import PricingPageShell from "../shared/PricingPageShell.jsx";

function normalizeId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pkgLabel(p) {
  const cur = p?.currency || "BWP";
  const amt = Number(p?.amount ?? 0);
  if (cur === "BWP") return `P${amt}`;
  return `${cur} ${amt}`;
}

export default function AdminPackagesPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    id: "",
    currency: "BWP",
    amount: 0,
    credits: 10,
    active: true,
    sort_order: 0,
  });

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-credit-packages?includeInactive=true");
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load packages");
      }
      setPackages(Array.isArray(data.packages) ? data.packages : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load packages" });
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => (packages || []).filter((p) => p?.active), [packages]);
  const inactive = useMemo(() => (packages || []).filter((p) => !p?.active), [packages]);

  function startNew() {
    setForm({ id: "", currency: "BWP", amount: 0, credits: 10, active: true, sort_order: 0 });
  }

  function startEdit(p) {
    setForm({
      id: p?.id || "",
      currency: p?.currency || "BWP",
      amount: Number(p?.amount ?? 0),
      credits: Number(p?.credits ?? 0),
      active: !!p?.active,
      sort_order: Number(p?.sort_order ?? 0),
    });
  }

  async function save() {
    const payload = {
      id: normalizeId(form.id),
      currency: String(form.currency || "BWP").trim().toUpperCase(),
      amount: Number(form.amount),
      credits: Number(form.credits),
      active: !!form.active,
      sort_order: Number(form.sort_order),
    };

    if (!payload.id) {
      addToast({ type: "error", message: "Package ID is required." });
      return;
    }
    if (!payload.currency) {
      addToast({ type: "error", message: "Currency is required." });
      return;
    }
    if (!Number.isFinite(payload.amount) || payload.amount < 0) {
      addToast({ type: "error", message: "Amount must be a number >= 0." });
      return;
    }
    if (!Number.isFinite(payload.credits) || payload.credits <= 0 || !Number.isInteger(payload.credits)) {
      addToast({ type: "error", message: "Credits must be a whole number > 0." });
      return;
    }

    const ok = await confirm({
      title: "Save package?",
      message: `Save ${payload.id} (${pkgLabel(payload)}) → ${payload.credits} credits?`,
      confirmLabel: "Save",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("admin-upsert-credit-package", { body: payload });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to save package");
      addToast({ type: "success", message: "Package saved." });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to save package" });
    } finally {
      setSaving(false);
    }
  }

  async function deletePkg() {
    const id = normalizeId(form.id);
    if (!id) return;

    const ok = await confirm({
      title: "Delete package?",
      message: `Delete package ${id}? Users will no longer be able to select it.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setDeleting(true);
    try {
      const { data, error } = await invokeWithAuth("admin-delete-credit-package", { body: { id } });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to delete package");
      addToast({ type: "success", message: "Package deleted." });
      startNew();
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to delete package" });
    } finally {
      setDeleting(false);
    }
  }

  const headerActions = (
    <>
      <Link
        to="/admindashboard/topup"
        className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white/90 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm hover:bg-white transition"
      >
        Top-up
      </Link>
      <RippleButton
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
        onClick={() => void load()}
        disabled={loading}
      >
        <RefreshCw size={16} />
        Refresh
      </RippleButton>
      <RippleButton
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
        onClick={startNew}
      >
        <Plus size={16} />
        New package
      </RippleButton>
    </>
  );

  return (
    <PricingPageShell
      title="Credit packages"
      subtitle="Manage the top-up packages shown in the app."
      actions={headerActions}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        <section className="lg:col-span-7 p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-100">
          <div className="text-sm font-semibold text-gray-800 mb-3">Packages</div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="space-y-6">
              <PackageTable title="Active" packages={active} onEdit={startEdit} />
              {inactive.length > 0 ? (
                <PackageTable title="Inactive" packages={inactive} onEdit={startEdit} />
              ) : null}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 p-5 sm:p-6 space-y-4">
          <div className="text-sm font-semibold text-gray-800">Add / edit package</div>

          <div>
            <label className="text-xs text-gray-600">ID</label>
            <input
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-mono"
              placeholder="e.g. BWP_30"
            />
            <p className="text-xs text-gray-400 mt-1">Uppercase letters, numbers, underscore.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Currency</label>
              <input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                placeholder="BWP"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Credits</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.credits}
                onChange={(e) => setForm((f) => ({ ...f, credits: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Sort order</label>
              <input
                type="number"
                step="1"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="accent-emerald-600"
              />
              Active
            </label>

            <RippleButton
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white font-semibold disabled:opacity-60"
              onClick={() => void deletePkg()}
              disabled={deleting || saving || !normalizeId(form.id)}
            >
              <Trash2 size={16} />
              Delete
            </RippleButton>
          </div>

          <RippleButton
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            onClick={() => void save()}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Saving…" : "Save package"}
          </RippleButton>
        </section>
      </div>
    </PricingPageShell>
  );
}

function PackageTable({ title, packages, onEdit }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</div>
      {packages.length === 0 ? (
        <div className="text-sm text-gray-500">None.</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Package</th>
                <th className="text-right font-semibold px-4 py-3">Credits</th>
                <th className="text-right font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{pkgLabel(p)}</div>
                    <div className="text-xs text-gray-400 font-mono">{p.id}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {Number(p.amount ?? 0)} {p.currency || "BWP"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {Number(p.credits ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RippleButton className="px-3 py-2 rounded-xl border bg-white text-sm" onClick={() => onEdit(p)}>
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

