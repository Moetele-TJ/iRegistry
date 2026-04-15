import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";

function reqMsg(label) {
  return `${label} is required.`;
}

export default function StaffAddOrgMemberPage({ staffBasePath = "/admin" }) {
  const { addToast } = useToast();
  const nav = useNavigate();
  const { orgId } = useParams();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    org_role: "ORG_MEMBER",
    first_name: "",
    last_name: "",
    id_number: "",
    phone: "",
    email: "",
    date_of_birth: "",
    village: "",
    ward: "",
  });

  const errors = useMemo(() => {
    const e = {};
    if (!String(form.last_name || "").trim()) e.last_name = reqMsg("Last name");
    if (!String(form.id_number || "").replace(/\s+/g, "").trim()) e.id_number = reqMsg("ID number");
    if (!String(form.phone || "").trim()) e.phone = reqMsg("Phone");
    if (form.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(String(form.date_of_birth).trim())) {
      e.date_of_birth = "Use YYYY-MM-DD.";
    }
    return e;
  }, [form]);

  async function loadOrg() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-orgs", {
        body: { q: String(orgId || ""), limit: 1 },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      const match = (Array.isArray(data.organizations) ? data.organizations : []).find((o) => o.id === orgId) ||
        (Array.isArray(data.organizations) ? data.organizations : [])[0] ||
        null;
      setOrg(match);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load organization" });
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orgId) return;
    void loadOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length) {
      addToast({ type: "warning", message: "Please fix the required fields." });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        org_id: orgId,
        org_role: form.org_role,
        first_name: form.first_name,
        last_name: form.last_name,
        id_number: form.id_number,
        phone: form.phone,
        email: form.email,
        date_of_birth: form.date_of_birth,
        village: form.village,
        ward: form.ward,
      };
      const { data, error } = await invokeWithAuth("staff-create-org-member", { body: payload });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Member added successfully (2 credits deducted)." });
      nav(`${staffBasePath}/organizations`, { replace: true });
    } catch (err) {
      addToast({ type: "error", message: err.message || "Failed to add member" });
    } finally {
      setSaving(false);
    }
  }

  const orgLabel = String(org?.name || "").trim() || org?.registration_no || orgId || "Organization";

  return (
    <PageSectionCard
      maxWidthClass="max-w-3xl"
      title="Add organization member"
      subtitle={loading ? "Loading…" : `Adds a user directly to ${orgLabel}. This costs 2 organization credits.`}
      icon={<UserPlus className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <Link
          to={`${staffBasePath}/organizations`}
          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50"
        >
          Back to organizations
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">Billing</div>
          <div className="text-emerald-900/80">Catalog item: Add member — 2 credits (organization wallet).</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">Organization role</div>
            <select
              value={form.org_role}
              onChange={(e) => setForm((p) => ({ ...p, org_role: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ORG_MEMBER">Member</option>
              <option value="ORG_MANAGER">Manager</option>
              <option value="ORG_ADMIN">Admin</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">First name</div>
            <input
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">
              Last name <span className="text-red-600">*</span>
            </div>
            <input
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {submitted && errors.last_name ? <div className="text-xs text-red-600">{errors.last_name}</div> : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">
              ID number <span className="text-red-600">*</span>
            </div>
            <input
              value={form.id_number}
              onChange={(e) => setForm((p) => ({ ...p, id_number: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
            />
            {submitted && errors.id_number ? <div className="text-xs text-red-600">{errors.id_number}</div> : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">
              Phone <span className="text-red-600">*</span>
            </div>
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {submitted && errors.phone ? <div className="text-xs text-red-600">{errors.phone}</div> : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">Email</div>
            <input
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">Date of birth</div>
            <input
              value={form.date_of_birth}
              onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
              placeholder="YYYY-MM-DD (optional)"
            />
            {submitted && errors.date_of_birth ? (
              <div className="text-xs text-red-600">{errors.date_of_birth}</div>
            ) : null}
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">Village</div>
            <input
              value={form.village}
              onChange={(e) => setForm((p) => ({ ...p, village: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>

          <label className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">Ward</div>
            <input
              value={form.ward}
              onChange={(e) => setForm((p) => ({ ...p, ward: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-gray-500">
            Fields marked with <span className="text-red-600">*</span> are required.
          </div>
          <RippleButton
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
          >
            Add member
          </RippleButton>
        </div>
      </form>
    </PageSectionCard>
  );
}

