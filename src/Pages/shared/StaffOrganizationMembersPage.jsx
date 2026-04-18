import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pencil, RefreshCw, Save, Users, X } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.id || "—";
}

function compact(v) {
  const s = String(v ?? "").trim();
  return s || "—";
}

export default function StaffOrganizationMembersPage({ staffBasePath = "/admin" }) {
  const { addToast } = useToast();
  const { orgId } = useOrgRouteResolution();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [includeInvited, setIncludeInvited] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    id_number: "",
    phone: "",
    email: "",
    date_of_birth: "",
    village: "",
    ward: "",
  });

  async function load() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("staff-list-org-members", {
        body: { org_id: orgId, includeInvited },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setRows(Array.isArray(data.members) ? data.members : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load members" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(m) {
    setSubmitted(false);
    setEditUserId(m.user_id);
    setForm({
      first_name: String(m.user?.first_name || ""),
      last_name: String(m.user?.last_name || ""),
      id_number: String(m.user?.id_number || ""),
      phone: String(m.user?.phone || ""),
      email: String(m.user?.email || ""),
      date_of_birth: String(m.user?.date_of_birth || "").slice(0, 10),
      village: String(m.user?.village || ""),
      ward: String(m.user?.ward || ""),
    });
  }

  function stopEdit() {
    setSubmitted(false);
    setEditUserId(null);
  }

  const errors = useMemo(() => {
    const e = {};
    if (!String(form.last_name || "").trim()) e.last_name = "Last name is required.";
    if (!String(form.id_number || "").replace(/\s+/g, "").trim()) e.id_number = "ID number is required.";
    if (!String(form.phone || "").trim()) e.phone = "Phone is required.";
    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(String(form.date_of_birth).trim())) {
      e.date_of_birth = "Use YYYY-MM-DD.";
    }
    return e;
  }, [form]);

  async function save() {
    setSubmitted(true);
    if (Object.keys(errors).length) {
      addToast({ type: "warning", message: "Please fix the required fields." });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("staff-update-org-member-user", {
        body: {
          org_id: orgId,
          user_id: editUserId,
          updates: {
            first_name: form.first_name,
            last_name: form.last_name,
            id_number: form.id_number,
            phone: form.phone,
            email: form.email,
            date_of_birth: form.date_of_birth || null,
            village: form.village,
            ward: form.ward,
          },
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Member details updated." });
      stopEdit();
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to update member" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!orgId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, includeInvited]);

  const members = useMemo(() => rows || [], [rows]);

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization members"
      subtitle="Staff view (admin/cashier)."
      icon={<Users className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex items-center gap-2">
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-4">
        <Link
          to={`${staffBasePath}/organizations`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft size={16} />
          Back to organizations
        </Link>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <input
            id="includeInvited"
            type="checkbox"
            checked={includeInvited}
            onChange={(e) => setIncludeInvited(e.target.checked)}
          />
          <label htmlFor="includeInvited">Show pending invitations</label>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">User</th>
                <th className="text-left font-semibold px-4 py-3">Contacts</th>
                <th className="text-left font-semibold px-4 py-3">Address</th>
                <th className="text-left font-semibold px-4 py-3">Membership</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={4}>
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <>
                    <tr key={m.user_id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{displayName(m.user)}</div>
                        <div className="text-xs text-gray-500 font-mono">{String(m.user_id).slice(0, 8)}…</div>
                        <div className="text-xs text-gray-600 mt-1">
                          ID: <span className="font-mono">{compact(m.user?.id_number)}</span>
                          {" · "}
                          DOB: <span className="font-mono">{compact(m.user?.date_of_birth)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="text-xs">{compact(m.user?.phone)}</div>
                        <div className="text-xs">{compact(m.user?.email)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="text-xs">Village: {compact(m.user?.village)}</div>
                        <div className="text-xs">Ward: {compact(m.user?.ward)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs">
                              Status: <span className="font-mono">{m.status}</span>
                            </div>
                            <div className="text-xs">
                              Role: <span className="font-mono">{m.role}</span>
                            </div>
                          </div>
                          <RippleButton
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                            onClick={() => startEdit(m)}
                            disabled={saving}
                            title="Edit member details"
                          >
                            <Pencil size={14} />
                            Edit
                          </RippleButton>
                        </div>
                      </td>
                    </tr>
                    {editUserId === m.user_id ? (
                      <tr key={`${m.user_id}-edit`}>
                        <td className="px-4 py-4 bg-gray-50/40" colSpan={4}>
                          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900">Edit details</div>
                              <RippleButton
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                                onClick={() => stopEdit()}
                                disabled={saving}
                              >
                                <X size={14} />
                                Close
                              </RippleButton>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">First name</div>
                                <input
                                  value={form.first_name}
                                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">
                                  Last name <span className="text-red-600">*</span>
                                </div>
                                <input
                                  value={form.last_name}
                                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                />
                                {submitted && errors.last_name ? (
                                  <div className="text-xs text-red-600">{errors.last_name}</div>
                                ) : null}
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">
                                  ID number <span className="text-red-600">*</span>
                                </div>
                                <input
                                  value={form.id_number}
                                  onChange={(e) => setForm((p) => ({ ...p, id_number: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
                                />
                                {submitted && errors.id_number ? (
                                  <div className="text-xs text-red-600">{errors.id_number}</div>
                                ) : null}
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">
                                  Phone <span className="text-red-600">*</span>
                                </div>
                                <input
                                  value={form.phone}
                                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                />
                                {submitted && errors.phone ? (
                                  <div className="text-xs text-red-600">{errors.phone}</div>
                                ) : null}
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">Email</div>
                                <input
                                  value={form.email}
                                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">Date of birth</div>
                                <input
                                  value={form.date_of_birth}
                                  onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
                                  placeholder="YYYY-MM-DD"
                                />
                                {submitted && errors.date_of_birth ? (
                                  <div className="text-xs text-red-600">{errors.date_of_birth}</div>
                                ) : null}
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">Village</div>
                                <input
                                  value={form.village}
                                  onChange={(e) => setForm((p) => ({ ...p, village: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                />
                              </label>

                              <label className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700">Ward</div>
                                <input
                                  value={form.ward}
                                  onChange={(e) => setForm((p) => ({ ...p, ward: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                />
                              </label>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-gray-500">
                                Fields marked with <span className="text-red-600">*</span> are required.
                              </div>
                              <RippleButton
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                                disabled={saving}
                                onClick={() => void save()}
                              >
                                <Save size={16} />
                                Save
                              </RippleButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageSectionCard>
  );
}

