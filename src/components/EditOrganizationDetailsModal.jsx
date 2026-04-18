import { useEffect, useState } from "react";
import { X } from "lucide-react";
import RippleButton from "./RippleButton.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useToast } from "../contexts/ToastContext.jsx";

function normalizeInitial(org) {
  return {
    name: String(org?.name ?? "").trim(),
    registration_no: org?.registration_no != null ? String(org.registration_no) : "",
    contact_email: org?.contact_email != null ? String(org.contact_email) : "",
    phone: org?.phone != null ? String(org.phone) : "",
    village: org?.village != null ? String(org.village) : "",
    ward: org?.ward != null ? String(org.ward) : "",
  };
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.orgId
 * @param {object} props.initial — org row (name, registration_no, contact_email, phone, village, ward)
 * @param {() => void | Promise<void>} [props.onSaved]
 */
export default function EditOrganizationDetailsModal({ open, onClose, orgId, initial, onSaved }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => normalizeInitial(initial || {}));

  useEffect(() => {
    if (open) setForm(normalizeInitial(initial || {}));
  }, [open, initial]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    const name = String(form.name || "").trim();
    if (!name) {
      addToast({ type: "error", message: "Organization name is required." });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await invokeWithAuth("update-organization", {
        body: {
          org_id: orgId,
          name,
          registration_no: form.registration_no?.trim() || null,
          contact_email: form.contact_email?.trim() || null,
          phone: form.phone?.trim() || null,
          village: form.village?.trim() || null,
          ward: form.ward?.trim() || null,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Update failed");
      }
      addToast({ type: "success", message: "Organization updated." });
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      addToast({ type: "error", message: err?.message || "Failed to update" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-org-title"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 id="edit-org-title" className="text-lg font-semibold text-gray-900">
            Edit organization
          </h2>
          <button
            type="button"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              autoComplete="organization"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Registration number</span>
            <input
              value={form.registration_no}
              onChange={(e) => setForm((f) => ({ ...f, registration_no: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Contact email</span>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Village</span>
              <input
                value={form.village}
                onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Ward</span>
              <input
                value={form.ward}
                onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <RippleButton
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save changes"}
            </RippleButton>
          </div>
        </form>
      </div>
    </div>
  );
}
