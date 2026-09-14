import { useEffect, useMemo, useState } from "react";
import { PawPrint, Plus, RefreshCw, Save, X } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import { NAV } from "../../lib/navLabels.js";

function slugTypeCode(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const EMPTY_FORM = {
  code: "",
  label: "",
  brand_bearing: false,
  ear_tag_bearing: true,
  ear_mark_bearing: true,
  active: true,
  isNew: true,
};

function formFromType(t) {
  return {
    code: t.code || "",
    label: t.label || "",
    brand_bearing: Boolean(t.brand_bearing),
    ear_tag_bearing: Boolean(t.ear_tag_bearing),
    ear_mark_bearing: Boolean(t.ear_mark_bearing),
    active: t.active !== false,
    isNew: false,
  };
}

function FlagPills({ row }) {
  const flags = [
    row?.brand_bearing ? "Brands" : null,
    row?.ear_tag_bearing ? "Ear tags" : null,
    row?.ear_mark_bearing ? "Ear marks" : null,
  ].filter(Boolean);
  if (!flags.length) {
    return <span className="text-xs text-gray-400">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-100"
        >
          {f}
        </span>
      ))}
    </div>
  );
}

export default function AdminLivestockTypesPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [codeDirty, setCodeDirty] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-admin-list-types" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load animal types");
      }
      setTypes(Array.isArray(data.types) ? data.types : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load animal types" });
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTypes = useMemo(() => (types || []).filter((t) => t?.active), [types]);
  const inactiveTypes = useMemo(() => (types || []).filter((t) => !t?.active), [types]);

  function closeForm() {
    setForm(null);
    setCodeDirty(false);
  }

  function startNew() {
    setForm({ ...EMPTY_FORM });
    setCodeDirty(false);
  }

  function startEdit(t) {
    setForm(formFromType(t));
    setCodeDirty(true);
  }

  function onLabelChange(label) {
    setForm((f) => {
      if (!f) return f;
      return {
        ...f,
        label,
        code: f.isNew && !codeDirty ? slugTypeCode(label) : f.code,
      };
    });
  }

  async function save() {
    if (!form) return;
    const label = String(form.label || "").trim();
    const code = form.isNew
      ? slugTypeCode(form.code) || slugTypeCode(label)
      : String(form.code || "").trim();
    if (!label) {
      addToast({ type: "error", message: "Display name is required." });
      return;
    }
    if (!code) {
      addToast({ type: "error", message: "Code is required." });
      return;
    }

    const ok = await confirm({
      title: form.isNew ? "Add animal type?" : "Save animal type?",
      message: form.isNew
        ? `Add “${label}” (${code}) to the catalog? Existing animals are unchanged; this only controls spelling and which attributes this type uses.`
        : `Save “${label}”? Registration and edit forms will show brands, ear tags, and ear marks only when enabled for this type.`,
      confirmLabel: form.isNew ? "Add type" : "Save type",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: {
          operation: "livestock-admin-upsert-type",
          code,
          label,
          brand_bearing: !!form.brand_bearing,
          ear_tag_bearing: !!form.ear_tag_bearing,
          ear_mark_bearing: !!form.ear_mark_bearing,
          active: !!form.active,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to save type");
      }
      addToast({ type: "success", message: form.isNew ? "Animal type added." : "Animal type saved." });
      closeForm();
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to save type" });
    } finally {
      setSaving(false);
    }
  }

  const headerActions = (
    <>
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
        New type
      </RippleButton>
    </>
  );

  return (
    <PageSectionCard
      title={NAV.livestockTypes}
      subtitle="Correct spelling and choose which attributes each animal type uses. Every animal is stored the same way; brands, ear tags, and ear marks are optional per type."
      icon={<PawPrint className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={headerActions}
    >
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-6">
            <TypeTable title="Active" types={activeTypes} onEdit={startEdit} />
            {inactiveTypes.length > 0 ? (
              <TypeTable title="Inactive" types={inactiveTypes} onEdit={startEdit} />
            ) : null}
          </div>
        )}
      </div>

      {form ? (
        <TypeEditorModal
          form={form}
          setForm={setForm}
          setCodeDirty={setCodeDirty}
          onLabelChange={onLabelChange}
          onClose={closeForm}
          onSave={() => void save()}
          saving={saving}
        />
      ) : null}
    </PageSectionCard>
  );
}

function TypeEditorModal({ form, setForm, setCodeDirty, onLabelChange, onClose, onSave, saving }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="animal-type-editor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 id="animal-type-editor-title" className="text-lg font-semibold text-gray-900">
            {form.isNew ? "Add animal type" : "Edit animal type"}
          </h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-600">Display name</label>
            <input
              value={form.label}
              onChange={(e) => onLabelChange(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="e.g. Cattle"
            />
            <p className="text-xs text-gray-400 mt-1">Shown on lists, registration, and animal details.</p>
          </div>

          <div>
            <label className="text-xs text-gray-600">Code</label>
            <input
              value={form.code}
              onChange={(e) => {
                setCodeDirty(true);
                setForm((f) => (f ? { ...f, code: e.target.value } : f));
              }}
              disabled={!form.isNew}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="e.g. cattle"
            />
            <p className="text-xs text-gray-400 mt-1">
              Stable key stored on each animal. Cannot change after the type is created.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Attributes for this type
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="accent-emerald-600"
                checked={form.brand_bearing}
                onChange={(e) => setForm((f) => (f ? { ...f, brand_bearing: e.target.checked } : f))}
              />
              Brands
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="accent-emerald-600"
                checked={form.ear_tag_bearing}
                onChange={(e) => setForm((f) => (f ? { ...f, ear_tag_bearing: e.target.checked } : f))}
              />
              Ear tags
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="accent-emerald-600"
                checked={form.ear_mark_bearing}
                onChange={(e) => setForm((f) => (f ? { ...f, ear_mark_bearing: e.target.checked } : f))}
              />
              Ear marks
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={form.active}
              onChange={(e) => setForm((f) => (f ? { ...f, active: e.target.checked } : f))}
            />
            Active (available when registering)
          </label>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <RippleButton
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </RippleButton>
          <RippleButton
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            onClick={onSave}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Saving…" : form.isNew ? "Add type" : "Save type"}
          </RippleButton>
        </div>
      </div>
    </div>
  );
}

function TypeTable({ title, types, onEdit }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{title}</div>
      {types.length === 0 ? (
        <div className="text-sm text-gray-500">None.</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-left font-semibold px-4 py-3">Attributes</th>
                <th className="text-right font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map((t) => (
                <tr key={t.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-400 font-mono">{t.code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <FlagPills row={t} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RippleButton
                      className="px-3 py-2 rounded-xl border bg-white text-sm"
                      onClick={() => onEdit(t)}
                    >
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
