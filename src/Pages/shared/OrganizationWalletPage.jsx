import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, Pencil, RefreshCw, Wallet } from "lucide-react";
import EditOrganizationDetailsModal from "../../components/EditOrganizationDetailsModal.jsx";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { formatMoneyAmount } from "../../lib/formatBWP.js";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

const PAGE_SIZE = 25;

function formatEntryType(t) {
  const s = String(t || "").trim();
  if (s === "CREDIT_ADD") return "Credit added";
  if (s === "CREDIT_SPEND") return "Credit spent";
  if (s === "ADJUSTMENT") return "Adjustment";
  if (s === "REFUND") return "Refund";
  return s || "—";
}

function PaymentStatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const tone =
    s === "CONFIRMED"
      ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
      : s === "PENDING"
        ? "bg-amber-50 text-amber-900 border border-amber-100"
        : s === "FAILED"
          ? "bg-red-50 text-red-800 border border-red-100"
          : s === "CANCELLED"
            ? "bg-gray-50 text-gray-700 border border-gray-100"
            : "bg-gray-50 text-gray-700 border border-gray-100";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status || "—"}</span>;
}

export default function OrganizationWalletPage() {
  const { orgSlug, orgId } = useOrgRouteResolution();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [organization, setOrganization] = useState(null);
  const [balance, setBalance] = useState(null);
  const [role, setRole] = useState(null);
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(null);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(null);
  const [paymentsPage, setPaymentsPage] = useState(0);

  const isPrivileged = role === "ORG_ADMIN" || role === "ORG_MANAGER";
  const isOrgAdmin = role === "ORG_ADMIN";

  const loadWallet = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("get-org-wallet", {
        body: { org_id: orgId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load wallet");
      const org = data?.organization || null;
      setOrganization(org);
      setOrgName(String(org?.name || "").trim() || "Organization");
      setBalance(typeof data.balance === "number" ? data.balance : 0);
      setRole(data.role || null);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load wallet" });
      setOrganization(null);
      setOrgName("");
      setBalance(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, orgId]);

  const fetchLedgerPage = useCallback(
    async (pageIdx) => {
      if (!orgId) return;
      setLedgerLoading(true);
      try {
        const { data, error } = await invokeWithAuth("list-org-ledger", {
          body: { org_id: orgId, limit: PAGE_SIZE, offset: pageIdx * PAGE_SIZE },
        });
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load ledger");
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setLedgerTotal(data.total ?? null);
      } catch (e) {
        addToast({ type: "error", message: e.message || "Failed to load ledger" });
        setEntries([]);
        setLedgerTotal(null);
      } finally {
        setLedgerLoading(false);
      }
    },
    [addToast, orgId],
  );

  const fetchPaymentsPage = useCallback(
    async (pageIdx) => {
      if (!orgId) return;
      setPaymentsLoading(true);
      try {
        const { data, error } = await invokeWithAuth("list-org-payments", {
          body: { org_id: orgId, limit: PAGE_SIZE, offset: pageIdx * PAGE_SIZE },
        });
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load payments");
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setPaymentsTotal(data.total ?? null);
      } catch (e) {
        addToast({ type: "error", message: e.message || "Failed to load payments" });
        setPayments([]);
        setPaymentsTotal(null);
      } finally {
        setPaymentsLoading(false);
      }
    },
    [addToast, orgId],
  );

  useEffect(() => {
    setOrganization(null);
    setEditOrgOpen(false);
    setBalance(null);
    setRole(null);
    setEntries([]);
    setLedgerTotal(null);
    setPayments([]);
    setPaymentsTotal(null);
    setLedgerPage(0);
    setPaymentsPage(0);
    void loadWallet();
  }, [loadWallet, orgId]);

  useEffect(() => {
    if (role == null) return;
    if (!isPrivileged) {
      setEntries([]);
      setLedgerTotal(null);
      setPayments([]);
      setPaymentsTotal(null);
      return;
    }
    void fetchLedgerPage(ledgerPage);
  }, [role, isPrivileged, ledgerPage, orgId, fetchLedgerPage]);

  useEffect(() => {
    if (role == null) return;
    if (!isPrivileged) return;
    void fetchPaymentsPage(paymentsPage);
  }, [role, isPrivileged, paymentsPage, orgId, fetchPaymentsPage]);

  const ledgerStart = entries.length === 0 ? 0 : ledgerPage * PAGE_SIZE + 1;
  const ledgerEnd = ledgerPage * PAGE_SIZE + entries.length;
  const ledgerHasPrev = ledgerPage > 0;
  const ledgerHasNext =
    typeof ledgerTotal === "number"
      ? (ledgerPage + 1) * PAGE_SIZE < ledgerTotal
      : entries.length === PAGE_SIZE;

  const payStart = payments.length === 0 ? 0 : paymentsPage * PAGE_SIZE + 1;
  const payEnd = paymentsPage * PAGE_SIZE + payments.length;
  const payHasPrev = paymentsPage > 0;
  const payHasNext =
    typeof paymentsTotal === "number"
      ? (paymentsPage + 1) * PAGE_SIZE < paymentsTotal
      : payments.length === PAGE_SIZE;

  function refreshAll() {
    void loadWallet();
    if (isPrivileged) {
      void fetchLedgerPage(ledgerPage);
      void fetchPaymentsPage(paymentsPage);
    }
  }

  return (
    <>
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization wallet"
      subtitle={
        orgName
          ? `Credits for ${orgName}. Billing for organization-owned items uses this balance.`
          : "Credits for organization-owned items."
      }
      icon={<Wallet className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isOrgAdmin && organization ? (
            <RippleButton
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-900 font-semibold shadow-sm hover:bg-emerald-100/80"
              type="button"
              onClick={() => setEditOrgOpen(true)}
            >
              <Pencil size={16} />
              Edit details
            </RippleButton>
          ) : null}
          <Link
            to={`/organizations/${orgSlug}/items`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Building2 size={16} />
            Items
          </Link>
          <Link
            to={`/organizations/${orgSlug}/transactions`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Transactions
          </Link>
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => refreshAll()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-6">
        <Link
          to="/user/organizations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft size={16} />
          Back to organizations
        </Link>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">Balance</div>
            <div className="text-3xl font-bold text-emerald-950 tabular-nums mt-1">
              {loading ? "…" : balance === null ? "—" : balance.toLocaleString()}{" "}
              <span className="text-lg font-semibold text-emerald-900/80">credits</span>
            </div>
          </div>
          <div className="text-sm text-emerald-900/80 max-w-md">
            Top-ups are completed by staff (cashier) into this organization wallet. Members see the balance; managers
            and administrators can review the credit ledger and staff top-up records below.
          </div>
        </div>

        {!isPrivileged ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
            Full transaction history is available to organization managers and administrators.
          </div>
        ) : null}

        {isPrivileged ? (
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm font-semibold text-gray-800">Credit ledger</div>
              {ledgerLoading ? <div className="text-xs text-gray-400">Loading…</div> : null}
              {typeof ledgerTotal === "number" ? (
                <div className="text-xs text-gray-500">{ledgerTotal} entries</div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">When</th>
                    <th className="text-left font-semibold px-4 py-3">Type</th>
                    <th className="text-right font-semibold px-4 py-3">Amount</th>
                    <th className="text-left font-semibold px-4 py-3">Task</th>
                    <th className="text-left font-semibold px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!ledgerLoading && entries.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-gray-500" colSpan={5}>
                        No ledger entries yet.
                      </td>
                    </tr>
                  ) : null}
                  {entries.map((row) => {
                    const isSpend = row.entry_type === "CREDIT_SPEND";
                    const amt = typeof row.amount === "number" ? row.amount : 0;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{formatEntryType(row.entry_type)}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${
                            isSpend ? "text-red-700" : "text-emerald-800"
                          }`}
                        >
                          {isSpend && amt > 0 ? "−" : ""}
                          {!isSpend && amt > 0 ? "+" : ""}
                          {amt.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{row.task_code || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate" title={row.reference || ""}>
                          {row.reference || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <div>
                {entries.length > 0 ? (
                  <>
                    Showing <span className="font-semibold tabular-nums">{ledgerStart}</span>–
                    <span className="font-semibold tabular-nums">{ledgerEnd}</span>
                    {typeof ledgerTotal === "number" ? (
                      <>
                        {" "}
                        of <span className="font-semibold tabular-nums">{ledgerTotal}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  " "
                )}
              </div>
              <div className="flex items-center gap-2">
                <RippleButton
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold disabled:opacity-50"
                  disabled={!ledgerHasPrev || ledgerLoading}
                  onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={18} />
                  Previous
                </RippleButton>
                <span className="text-xs text-gray-500 tabular-nums">Page {ledgerPage + 1}</span>
                <RippleButton
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold disabled:opacity-50"
                  disabled={!ledgerHasNext || ledgerLoading}
                  onClick={() => setLedgerPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={18} />
                </RippleButton>
              </div>
            </div>
          </div>
        ) : null}

        {isPrivileged ? (
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm font-semibold text-gray-800">Staff top-ups (payments)</div>
              {paymentsLoading ? <div className="text-xs text-gray-400">Loading…</div> : null}
              {typeof paymentsTotal === "number" ? (
                <div className="text-xs text-gray-500">{paymentsTotal} record(s)</div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">When</th>
                    <th className="text-left font-semibold px-4 py-3">Channel</th>
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-right font-semibold px-4 py-3">Money</th>
                    <th className="text-right font-semibold px-4 py-3">Credits</th>
                    <th className="text-left font-semibold px-4 py-3">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!paymentsLoading && payments.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-gray-500" colSpan={6}>
                        No payment records yet.
                      </td>
                    </tr>
                  ) : null}
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{String(p.channel || "—")}</td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 tabular-nums">
                        {formatMoneyAmount(p.currency, p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-900 tabular-nums">
                        +{typeof p.credits_granted === "number" ? p.credits_granted.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs max-w-[140px] truncate" title={p.receipt_no || ""}>
                        {p.receipt_no || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
              <div>
                {payments.length > 0 ? (
                  <>
                    Showing <span className="font-semibold tabular-nums">{payStart}</span>–
                    <span className="font-semibold tabular-nums">{payEnd}</span>
                    {typeof paymentsTotal === "number" ? (
                      <>
                        {" "}
                        of <span className="font-semibold tabular-nums">{paymentsTotal}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  " "
                )}
              </div>
              <div className="flex items-center gap-2">
                <RippleButton
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold disabled:opacity-50"
                  disabled={!payHasPrev || paymentsLoading}
                  onClick={() => setPaymentsPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={18} />
                  Previous
                </RippleButton>
                <span className="text-xs text-gray-500 tabular-nums">Page {paymentsPage + 1}</span>
                <RippleButton
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold disabled:opacity-50"
                  disabled={!payHasNext || paymentsLoading}
                  onClick={() => setPaymentsPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={18} />
                </RippleButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageSectionCard>

    <EditOrganizationDetailsModal
      open={editOrgOpen}
      onClose={() => setEditOrgOpen(false)}
      orgId={orgId || ""}
      initial={organization || {}}
      onSaved={() => void loadWallet()}
    />
    </>
  );
}
