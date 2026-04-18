import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronRight, RefreshCw, Search, Plus, X } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { orgPathSegment } from "../../lib/orgPath.js";
import { useToast } from "../../contexts/ToastContext.jsx";

function orgLabel(o) {
  return String(o?.name || "").trim() || o?.registration_no || o?.id || "—";
}

export default function StaffOrganizationsPage({ title = "Organizations", subtitle = "Browse organizations." }) {
  const { addToast } = useToast();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [addOrgBusy, setAddOrgBusy] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    registration_no: "",
    contact_email: "",
    phone: "",
    village: "",
    ward: "",
  });
  const staffBasePath =
    typeof window !== "undefined" && window.location?.pathname?.startsWith("/cashier")
      ? "/cashier"
      : "/admin";

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("staff-list-orgs-summary", {
        body: { q: q.trim() || "", limit: 200 },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setRows(Array.isArray(data.organizations) ? data.organizations : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load organizations" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const organizations = useMemo(() => rows || [], [rows]);

  function resetAddForm() {
    setAddForm({
      name: "",
      registration_no: "",
      contact_email: "",
      phone: "",
      village: "",
      ward: "",
    });
  }

  async function submitAddOrganization(e) {
    e?.preventDefault?.();
    const name = String(addForm.name || "").trim();
    if (!name) {
      addToast({ type: "error", message: "Organization name is required." });
      return;
    }
    setAddOrgBusy(true);
    try {
      const { data, error } = await invokeWithAuth("create-organization", {
        body: {
          name,
          registration_no: addForm.registration_no?.trim() || null,
          contact_email: addForm.contact_email?.trim() || null,
          phone: addForm.phone?.trim() || null,
          village: addForm.village?.trim() || null,
          ward: addForm.ward?.trim() || null,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not create organization");
      }
      addToast({ type: "success", message: "Organization created." });
      setAddOrgOpen(false);
      resetAddForm();
      await load();
    } catch (err) {
      addToast({ type: "error", message: err?.message || "Failed to create organization" });
    } finally {
      setAddOrgBusy(false);
    }
  }

  return (
    <>
      <PageSectionCard
        maxWidthClass="max-w-7xl"
        title={title}
        subtitle={subtitle}
        icon={<Building2 className="w-6 h-6 text-iregistrygreen shrink-0" />}
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <RippleButton
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-900 font-semibold shadow-sm hover:bg-emerald-100/80"
              onClick={() => {
                resetAddForm();
                setAddOrgOpen(true);
              }}
              type="button"
            >
              <Plus size={16} />
              Add organization
            </RippleButton>
            <RippleButton
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
              onClick={() => void load()}
              disabled={loading}
              type="button"
            >
              <RefreshCw size={16} />
              Refresh
            </RippleButton>
          </div>
        }
      >
        <div className="p-4 sm:p-6 space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="relative w-full sm:w-[420px] max-w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or registration number…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load();
                }}
              />
            </div>
            <RippleButton
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
              disabled={loading}
              onClick={() => void load()}
            >
              Search
            </RippleButton>
          </div>

          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-8 text-sm text-gray-500 text-center">
                Loading…
              </div>
            ) : organizations.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-8 text-sm text-gray-500 text-center">
                No organizations found.
              </div>
            ) : (
              organizations.map((o) => (
                <article
                  key={o.id}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-4"
                >
                  <div>
                    <Link
                      to={`${staffBasePath}/organizations/${orgPathSegment(o)}`}
                      className="font-semibold text-emerald-900 hover:text-emerald-950 hover:underline underline-offset-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 text-base"
                    >
                      {orgLabel(o)}
                    </Link>
                    <div className="text-xs text-gray-600 mt-1">
                      Reg: {String(o.registration_no || "").trim() || "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wallet</div>
                    <div className="font-semibold tabular-nums text-gray-900 mt-0.5">
                      {Number(o?.wallet?.balance ?? 0).toLocaleString()} credits
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Updated:{" "}
                      {o?.wallet?.updated_at ? new Date(o.wallet.updated_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/organizations/${orgPathSegment(o)}/items`}
                      className="inline-flex flex-1 min-w-[5.5rem] items-center justify-center px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                    >
                      Items
                    </Link>
                    <Link
                      to={`/organizations/${orgPathSegment(o)}/wallet`}
                      className="inline-flex flex-1 min-w-[5.5rem] items-center justify-center px-3 py-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                    >
                      Wallet
                    </Link>
                    <Link
                      to={`${staffBasePath}/organizations/${orgPathSegment(o)}`}
                      className="inline-flex flex-1 min-w-[6rem] items-center justify-center gap-0.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 text-xs font-semibold hover:bg-emerald-100"
                    >
                      More
                      <ChevronRight size={14} className="shrink-0" aria-hidden />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden md:block rounded-2xl border border-gray-100 bg-white overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Organization</th>
                  <th className="text-left font-semibold px-4 py-3">Wallet</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-gray-500" colSpan={3}>
                      Loading…
                    </td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-gray-500" colSpan={3}>
                      No organizations found.
                    </td>
                  </tr>
                ) : (
                  organizations.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <Link
                          to={`${staffBasePath}/organizations/${orgPathSegment(o)}`}
                          className="font-semibold text-emerald-900 hover:text-emerald-950 hover:underline underline-offset-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 inline-block"
                        >
                          {orgLabel(o)}
                        </Link>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {String(o.registration_no || "").trim() || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-semibold tabular-nums">
                          {Number(o?.wallet?.balance ?? 0).toLocaleString()} credits
                        </div>
                        <div className="text-xs text-gray-500">
                          Updated:{" "}
                          {o?.wallet?.updated_at ? new Date(o.wallet.updated_at).toLocaleDateString() : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <Link
                            to={`/organizations/${orgPathSegment(o)}/items`}
                            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                          >
                            Items
                          </Link>
                          <Link
                            to={`/organizations/${orgPathSegment(o)}/wallet`}
                            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                          >
                            Wallet
                          </Link>
                          <Link
                            to={`${staffBasePath}/organizations/${orgPathSegment(o)}`}
                            className="inline-flex items-center justify-center gap-0.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 text-xs font-semibold hover:bg-emerald-100"
                          >
                            More
                            <ChevronRight size={14} className="shrink-0" aria-hidden />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageSectionCard>

      {addOrgOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-org-title"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <h2 id="add-org-title" className="text-lg font-semibold text-gray-900">
                Add organization
              </h2>
              <button
                type="button"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                onClick={() => {
                  setAddOrgOpen(false);
                  resetAddForm();
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitAddOrganization} className="p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Name *</span>
                <input
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Organization name"
                  autoComplete="organization"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Registration number</span>
                <input
                  value={addForm.registration_no}
                  onChange={(e) => setAddForm((f) => ({ ...f, registration_no: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Contact email</span>
                <input
                  type="email"
                  value={addForm.contact_email}
                  onChange={(e) => setAddForm((f) => ({ ...f, contact_email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-700">Phone</span>
                <input
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Village</span>
                  <input
                    value={addForm.village}
                    onChange={(e) => setAddForm((f) => ({ ...f, village: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Ward</span>
                  <input
                    value={addForm.ward}
                    onChange={(e) => setAddForm((f) => ({ ...f, ward: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => {
                    setAddOrgOpen(false);
                    resetAddForm();
                  }}
                >
                  Cancel
                </button>
                <RippleButton
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                  disabled={addOrgBusy}
                >
                  {addOrgBusy ? "Creating…" : "Create organization"}
                </RippleButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
