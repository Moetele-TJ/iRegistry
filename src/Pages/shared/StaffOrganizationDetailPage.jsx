import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import EditOrganizationDetailsModal from "../../components/EditOrganizationDetailsModal.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

function orgLabel(o) {
  return String(o?.name || "").trim() || o?.registration_no || o?.id || "—";
}

function pkgLabel(p) {
  const cur = p?.currency || "BWP";
  const amt = Number(p?.amount ?? 0);
  if (cur === "BWP") return `P${amt}`;
  return `${cur} ${amt}`;
}

/**
 * @param {object} props
 * @param {string} props.staffBasePath — `/admin` or `/cashier`
 */
export default function StaffOrganizationDetailPage({ staffBasePath }) {
  const { addToast } = useToast();
  const { confirm, alert } = useModal();
  const navigate = useNavigate();

  const {
    orgKey,
    orgId,
    organization,
    balance,
    loading,
    error,
    reload,
    refreshOrganization,
  } = useOrgRouteResolution();

  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    try {
      const { data, error: invErr } = await invokeWithAuth("list-credit-packages");
      if (invErr || !data?.success) throw new Error(data?.message || invErr?.message || "Failed");
      setPackages(Array.isArray(data.packages) ? data.packages : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load packages" });
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  async function openTopup() {
    const o = organization;
    if (!o?.id) return;
    const pkg0 = (packages || [])[0] || null;
    const state = { packageId: pkg0?.id ? String(pkg0.id) : "", receiptNo: "", note: "" };

    const ok = await confirm({
      title: "Top up organization",
      message: `Credit ${orgLabel(o)} with a package.`,
      confirmLabel: "Confirm top-up",
      cancelLabel: "Cancel",
      confirmDisabled: loadingPackages || !packages?.length,
      children: (
        <div className="space-y-3">
          {loadingPackages ? (
            <div className="text-sm text-gray-600">Loading packages…</div>
          ) : !packages?.length ? (
            <div className="text-sm text-red-700">No active credit packages found.</div>
          ) : (
            <>
              <label className="block">
                <div className="text-xs font-semibold text-gray-700 mb-1">Package</div>
                <select
                  defaultValue={state.packageId}
                  onChange={(e) => {
                    state.packageId = e.target.value;
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  {(packages || []).map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {pkgLabel(p)} • {Number(p.credits ?? 0)} credits
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="text-xs font-semibold text-gray-700 mb-1">Receipt number *</div>
                <input
                  placeholder="e.g. RCPT-1234"
                  onChange={(e) => {
                    state.receiptNo = e.target.value;
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <div className="text-xs font-semibold text-gray-700 mb-1">Note (optional)</div>
                <textarea
                  rows={3}
                  onChange={(e) => {
                    state.note = e.target.value;
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
        </div>
      ),
      onConfirm: async () => {
        const rid = String(state.receiptNo || "").trim();
        if (!rid) throw new Error("Receipt number is required.");
        const pid = String(state.packageId || "").trim();
        if (!pid) throw new Error("Package is required.");

        const { data, error: invErr } = await invokeWithAuth("cashier-org-topup", {
          body: {
            org_id: o.id,
            package_id: pid,
            receipt_no: rid,
            note: String(state.note || "").trim() || null,
          },
        });
        if (invErr || !data?.success) throw new Error(data?.message || invErr?.message || "Top up failed");
        addToast({ type: "success", message: "Top-up complete." });
        await alert({
          title: "Top-up complete",
          message: `New balance: ${data.new_balance ?? "—"} credits`,
          confirmLabel: "Close",
          children: (
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                Receipt: <span className="font-mono">{String(rid)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/organizations/${orgKey}/wallet`}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                >
                  View wallet
                </Link>
                <Link
                  to={`/organizations/${orgKey}/transactions`}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                >
                  View transactions
                </Link>
              </div>
            </div>
          ),
        });
        await refreshOrganization();
      },
    }).catch((e) => {
      addToast({ type: "error", message: e.message || "Top up failed" });
      return false;
    });
    if (!ok) return;
  }

  const listPath = `${staffBasePath}/organizations`;

  async function handleDelete() {
    if (!organization?.id || !orgId) return;
    const ok = await confirm({
      title: "Delete organization?",
      message: `Permanently delete “${orgLabel(organization)}”? This cannot be undone. The organization must not own any registry items.`,
      confirmLabel: "Delete organization",
      cancelLabel: "Cancel",
      danger: true,
      onConfirm: async () => {
        const { data, error } = await invokeWithAuth("delete-organization", {
          body: { org_id: orgId },
        });
        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to delete organization");
        }
        addToast({ type: "success", message: "Organization deleted." });
        navigate(listPath);
      },
    }).catch((e) => {
      addToast({ type: "error", message: e?.message || "Could not delete organization" });
      return false;
    });
    if (!ok) return;
  }

  const actionClass =
    "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 transition-colors text-left";

  return (
    <>
      <PageSectionCard
        maxWidthClass="max-w-4xl"
        title={loading ? "Organization" : orgLabel(organization) || "Organization"}
        subtitle="All actions for this organization."
        icon={<Building2 className="w-6 h-6 text-iregistrygreen shrink-0" />}
        actions={
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => void reload()}
            disabled={loading}
            type="button"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </RippleButton>
        }
      >
        <div className="p-4 sm:p-6 space-y-6">
          <Link
            to={listPath}
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
          >
            <ArrowLeft size={16} />
            Back to organizations
          </Link>

          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : error || !organization ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
              {error || "Organization not found or you don&apos;t have access."}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,auto)_1fr] lg:gap-10 lg:items-start">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">Wallet balance</div>
                    <div className="text-3xl font-bold text-emerald-950 tabular-nums mt-1">
                      {balance === null ? "—" : balance.toLocaleString()}{" "}
                      <span className="text-lg font-semibold text-emerald-900/80">credits</span>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm text-gray-700 min-w-0">
                    {organization.registration_no ? (
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Registration</dt>
                        <dd className="mt-0.5 font-mono text-gray-900 break-all">{organization.registration_no}</dd>
                      </div>
                    ) : null}
                    {(organization.contact_email || organization.phone) && (
                      <div
                        className={`min-w-0 space-y-4 ${
                          organization.village || organization.ward ? "sm:col-span-1" : "sm:col-span-2"
                        }`}
                      >
                        {organization.contact_email ? (
                          <div>
                            <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Email</dt>
                            <dd className="mt-0.5 text-gray-900 break-words">{organization.contact_email}</dd>
                          </div>
                        ) : null}
                        {organization.phone ? (
                          <div>
                            <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Phone</dt>
                            <dd className="mt-0.5 text-gray-900 tabular-nums">{organization.phone}</dd>
                          </div>
                        ) : null}
                      </div>
                    )}
                    {(organization.village || organization.ward) && (
                      <div className="min-w-0 sm:col-span-1">
                        <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Location</dt>
                        <dd className="mt-0.5 text-gray-900">
                          {[organization.village, organization.ward].filter(Boolean).join(" · ")}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link to={`/organizations/${orgKey}/items`} className={actionClass}>
                    <Building2 size={18} className="text-gray-500 shrink-0" />
                    <span>View items</span>
                    <ChevronRight size={18} className="text-gray-400 ml-auto shrink-0" />
                  </Link>
                  <Link to={`/organizations/${orgKey}/wallet`} className={`${actionClass} border-emerald-200 bg-emerald-50/50`}>
                    <Wallet size={18} className="text-emerald-700 shrink-0" />
                    <span>Organization wallet</span>
                    <ChevronRight size={18} className="text-emerald-600/80 ml-auto shrink-0" />
                  </Link>
                  <Link to={`/organizations/${orgKey}/transactions`} className={actionClass}>
                    <ReceiptText size={18} className="text-gray-500 shrink-0" />
                    <span>Transactions</span>
                    <ChevronRight size={18} className="text-gray-400 ml-auto shrink-0" />
                  </Link>
                  <Link to={`${staffBasePath}/organizations/${orgKey}/members`} className={actionClass}>
                    <Users size={18} className="text-gray-500 shrink-0" />
                    <span>Members</span>
                    <ChevronRight size={18} className="text-gray-400 ml-auto shrink-0" />
                  </Link>
                  <Link
                    to={`${staffBasePath}/organizations/${orgKey}/add-member`}
                    className={`${actionClass} border-emerald-200 bg-white`}
                  >
                    <UserPlus size={18} className="text-emerald-700 shrink-0" />
                    <span>Add member</span>
                    <ChevronRight size={18} className="text-emerald-600/80 ml-auto shrink-0" />
                  </Link>
                  <RippleButton
                    type="button"
                    className={`${actionClass} w-full sm:col-span-1`}
                    onClick={() => void openTopup()}
                    disabled={loadingPackages}
                  >
                    <Plus size={18} className="text-gray-500 shrink-0" />
                    <span>Top up wallet</span>
                  </RippleButton>
                  <RippleButton
                    type="button"
                    className={`${actionClass} w-full sm:col-span-2 border-dashed`}
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil size={18} className="text-gray-500 shrink-0" />
                    <span>Edit organization details</span>
                  </RippleButton>
                </div>

                <div className="mt-8 pt-6 border-t border-red-100">
                  <div className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-2">Danger zone</div>
                  <p className="text-xs text-gray-600 mb-3 max-w-xl">
                    Deleting removes the organization, its wallet, memberships, and related records. You cannot delete
                    while this organization still owns any items in the registry.
                  </p>
                  <RippleButton
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-200 bg-red-50 text-sm font-semibold text-red-900 shadow-sm hover:bg-red-100/80 transition-colors"
                    onClick={() => void handleDelete()}
                  >
                    <Trash2 size={18} className="shrink-0" />
                    Delete organization
                  </RippleButton>
                </div>
              </div>
            </>
          )}
        </div>
      </PageSectionCard>

      <EditOrganizationDetailsModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        orgId={orgId || ""}
        initial={organization || {}}
        onSaved={() => void reload()}
      />
    </>
  );
}
