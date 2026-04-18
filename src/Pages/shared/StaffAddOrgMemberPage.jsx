import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

function reqMsg(label) {
  return `${label} is required.`;
}

export default function StaffAddOrgMemberPage({ staffBasePath = "/admin" }) {
  const { addToast } = useToast();
  const nav = useNavigate();
  const { orgKey, orgId, organization: org, loading, error: orgError } = useOrgRouteResolution();

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [receipt, setReceipt] = useState(null);

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

  useEffect(() => {
    let alive = true;
    const idn = String(form.id_number || "").replace(/\s+/g, "").trim();
    const ph = String(form.phone || "").trim();
    const em = String(form.email || "").trim().toLowerCase();

    if (!idn && !ph && !em) {
      setMatches([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLookupLoading(true);
        const { data, error } = await invokeWithAuth("staff-lookup-user", {
          body: { id_number: idn || null, phone: ph || null, email: em || null },
        });
        if (!alive) return;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Lookup failed");
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch {
        // Silent; lookup is best-effort.
        if (!alive) return;
        setMatches([]);
      } finally {
        if (alive) setLookupLoading(false);
      }
    }, 450);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [form.id_number, form.phone, form.email]);

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
      setReceipt({
        user: data.user,
        membership: data.membership,
        billing: data.billing || null,
        created_at: data.billing?.ledger?.created_at || new Date().toISOString(),
      });
      addToast({ type: "success", message: "Member added successfully." });
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
      subtitle={
        loading
          ? "Loading…"
          : orgError
            ? orgError
            : `Adds a user directly to ${orgLabel}. This costs 2 organization credits.`
      }
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
      {receipt ? (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Receipt</div>
            <div className="text-lg font-semibold text-gray-900">Member added</div>
            <div className="text-sm text-gray-700 mt-1">
              Organization: <span className="font-semibold">{orgLabel}</span>
            </div>
            <div className="text-sm text-gray-700">
              Role: <span className="font-mono">{receipt.membership?.role || "ORG_MEMBER"}</span>
            </div>
            <div className="text-sm text-gray-700">
              User:{" "}
              <span className="font-semibold">
                {[receipt.user?.first_name, receipt.user?.last_name].filter(Boolean).join(" ").trim() ||
                  receipt.user?.email ||
                  receipt.user?.id_number ||
                  "—"}
              </span>
            </div>
            <div className="text-xs text-gray-500 font-mono mt-1">User ID: {receipt.user?.id}</div>

            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="font-semibold">Billing</div>
              <div className="text-emerald-900/80">
                Add member — 2 credits
                {receipt.billing?.new_balance !== undefined && receipt.billing?.new_balance !== null
                  ? ` · New balance: ${receipt.billing.new_balance}`
                  : ""}
              </div>
              {receipt.billing?.ledger?.id ? (
                <div className="text-xs text-emerald-900/70 font-mono mt-1">Ledger: {receipt.billing.ledger.id}</div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between print:hidden">
              <div className="inline-flex items-center gap-2">
                <RippleButton
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold"
                  onClick={() => window.print()}
                >
                  Print
                </RippleButton>
                <RippleButton
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50"
                  onClick={() => nav(`${staffBasePath}/organizations/${orgKey}/members`)}
                >
                  View members
                </RippleButton>
              </div>
              <RippleButton
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50"
                onClick={() => {
                  setReceipt(null);
                  setSubmitted(false);
                  setForm({
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
                }}
              >
                Add another
              </RippleButton>
            </div>
          </div>
        </div>
      ) : (
      <form onSubmit={onSubmit} className="p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">Billing</div>
          <div className="text-emerald-900/80">Catalog item: Add member — 2 credits (organization wallet).</div>
        </div>

        {lookupLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            Checking for existing users…
          </div>
        ) : matches.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Possible duplicate found</div>
            <div className="text-amber-900/80">
              A user already exists with the same ID number / phone / email. Creating a new user will fail.
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {matches.slice(0, 3).map((u) => (
                <div key={u.id} className="font-mono">
                  {String(u.id).slice(0, 8)}… — {u.first_name || ""} {u.last_name || ""} — {u.id_number || "—"} —{" "}
                  {u.phone || "—"} — {u.email || "—"}
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
            disabled={saving || loading || !orgId || !!orgError}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
          >
            Add member
          </RippleButton>
        </div>
      </form>
      )}
    </PageSectionCard>
  );
}

