import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Download, RefreshCw, Search, Wallet } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { formatMoneyAmount } from "../../lib/formatBWP.js";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

const FETCH_LIMIT = 200;

function safeCsv(v) {
  const s = String(v ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCsv(filename, rows) {
  const blob = new Blob([rows.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeLedgerRow(r) {
  const entry = String(r?.entry_type || "");
  const title =
    entry === "CREDIT_SPEND"
      ? "Credit spent"
      : entry === "CREDIT_ADD"
        ? "Credit added"
        : entry === "REFUND"
          ? "Refund"
          : entry === "ADJUSTMENT"
            ? "Adjustment"
            : entry || "Ledger";
  return {
    kind: "LEDGER",
    id: r.id,
    created_at: r.created_at,
    title,
    subtitle: r.task_code ? `Task: ${r.task_code}` : "—",
    creditsDelta: entry === "CREDIT_SPEND" ? -Number(r.amount || 0) : Number(r.amount || 0),
    money: null,
    status: null,
    reference: r.reference || "",
    raw: r,
  };
}

function normalizePaymentRow(p) {
  return {
    kind: "PAYMENT",
    id: p.id,
    created_at: p.created_at,
    title: "Top-up",
    subtitle: `Channel: ${p.channel || "—"}`,
    creditsDelta: Number(p.credits_granted || 0),
    money: formatMoneyAmount(p.currency, p.amount),
    status: p.status || null,
    reference: p.receipt_no || p.provider_reference || "",
    raw: p,
  };
}

export default function OrganizationTransactionsPage() {
  const { orgSlug, orgId } = useOrgRouteResolution();
  const { addToast } = useToast();

  const [orgName, setOrgName] = useState("");
  const [balance, setBalance] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [ledger, setLedger] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledgerOffset, setLedgerOffset] = useState(0);
  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [ledgerTotal, setLedgerTotal] = useState(null);
  const [paymentsTotal, setPaymentsTotal] = useState(null);

  const [q, setQ] = useState("");
  const [showLedger, setShowLedger] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  const [ledgerType, setLedgerType] = useState("ALL"); // ALL | CREDIT_SPEND | CREDIT_ADD | REFUND | ADJUSTMENT

  const isPrivileged = role === "ORG_ADMIN" || role === "ORG_MANAGER" || role === "STAFF";

  async function loadWalletHeader() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("get-org-wallet", { body: { org_id: orgId } });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setOrgName(String(data?.organization?.name || "").trim());
      setBalance(typeof data.balance === "number" ? data.balance : 0);
      setRole(data.role || null);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load wallet" });
      setOrgName("");
      setBalance(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedgerPage({ offset, append }) {
    if (!orgId) return;
    setLedgerLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-org-ledger", {
        body: { org_id: orgId, limit: FETCH_LIMIT, offset },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      const rows = Array.isArray(data.entries) ? data.entries : [];
      setLedgerTotal(data.total ?? null);
      setLedger((prev) => (append ? [...prev, ...rows] : rows));
      setLedgerOffset(offset + rows.length);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load ledger" });
      setLedger((prev) => (append ? prev : []));
    } finally {
      setLedgerLoading(false);
    }
  }

  async function loadPaymentsPage({ offset, append }) {
    if (!orgId) return;
    setPaymentsLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-org-payments", {
        body: { org_id: orgId, limit: FETCH_LIMIT, offset },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      const rows = Array.isArray(data.payments) ? data.payments : [];
      setPaymentsTotal(data.total ?? null);
      setPayments((prev) => (append ? [...prev, ...rows] : rows));
      setPaymentsOffset(offset + rows.length);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load payments" });
      setPayments((prev) => (append ? prev : []));
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function refreshAll() {
    await loadWalletHeader();
    if (!isPrivileged) return;
    await Promise.all([
      loadLedgerPage({ offset: 0, append: false }),
      loadPaymentsPage({ offset: 0, append: false }),
    ]);
  }

  useEffect(() => {
    setLedger([]);
    setPayments([]);
    setLedgerOffset(0);
    setPaymentsOffset(0);
    setLedgerTotal(null);
    setPaymentsTotal(null);
    void loadWalletHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    if (!isPrivileged) return;
    void loadLedgerPage({ offset: 0, append: false });
    void loadPaymentsPage({ offset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isPrivileged]);

  const merged = useMemo(() => {
    const rows = [];
    if (showLedger) {
      const filteredLedger =
        ledgerType === "ALL"
          ? ledger || []
          : (ledger || []).filter((r) => String(r?.entry_type || "") === ledgerType);
      rows.push(...filteredLedger.map(normalizeLedgerRow));
    }
    if (showPayments) rows.push(...(payments || []).map(normalizePaymentRow));
    rows.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    });
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = [
        r.kind,
        r.title,
        r.subtitle,
        r.status,
        r.reference,
        r.raw?.task_code,
        r.raw?.entry_type,
        r.raw?.receipt_no,
        r.raw?.provider_reference,
        r.raw?.channel,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return hay.includes(needle);
    });
  }, [ledger, payments, q, showLedger, showPayments, ledgerType]);

  const canLoadMoreLedger =
    typeof ledgerTotal === "number" ? ledgerOffset < ledgerTotal : ledger.length >= FETCH_LIMIT;
  const canLoadMorePayments =
    typeof paymentsTotal === "number" ? paymentsOffset < paymentsTotal : payments.length >= FETCH_LIMIT;

  function exportCsv() {
    const now = new Date();
    const filename = `org-${orgSlug || orgId}-transactions-${now.toISOString().slice(0, 10)}.csv`;
    const header = ["created_at", "kind", "title", "status", "credits_delta", "money", "reference", "ledger_entry_type"];
    const lines = [header.map(safeCsv).join(",")];
    for (const r of merged.slice(0, 2000)) {
      lines.push(
        [
          r.created_at || "",
          r.kind,
          r.title,
          r.status || "",
          String(r.creditsDelta ?? ""),
          r.money || "",
          r.reference || "",
          r.kind === "LEDGER" ? String(r.raw?.entry_type || "") : "",
        ]
          .map(safeCsv)
          .join(","),
      );
    }
    downloadCsv(filename, lines);
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization transactions"
      subtitle={orgName ? `Transactions for ${orgName}.` : "Transactions for this organization."}
      icon={<Wallet className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/organizations/${orgSlug}/wallet`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Wallet size={16} />
            Wallet
          </Link>
          <Link
            to={`/organizations/${orgSlug}/items`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Building2 size={16} />
            Items
          </Link>
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => void refreshAll()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50"
            onClick={() => exportCsv()}
            disabled={!isPrivileged || merged.length === 0}
          >
            <Download size={16} />
            Export CSV
          </RippleButton>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5">
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
            {isPrivileged
              ? "Combined feed of credit ledger entries and staff top-ups."
              : "Full transaction history is available to organization managers/administrators and staff."}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search transactions…"
                className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm w-[280px] max-w-full"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
              <input type="checkbox" checked={showLedger} onChange={(e) => setShowLedger(e.target.checked)} />
              Ledger
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
              <input type="checkbox" checked={showPayments} onChange={(e) => setShowPayments(e.target.checked)} />
              Payments
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
              <span className="text-xs text-gray-500">Ledger type</span>
              <select
                value={ledgerType}
                onChange={(e) => setLedgerType(e.target.value)}
                disabled={!showLedger}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                title="Filter ledger entries"
              >
                <option value="ALL">All</option>
                <option value="CREDIT_SPEND">Spend</option>
                <option value="CREDIT_ADD">Add</option>
                <option value="REFUND">Refund</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </label>
          </div>

          {isPrivileged ? (
            <div className="flex flex-wrap items-center gap-2">
              <RippleButton
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 font-semibold disabled:opacity-50"
                disabled={!canLoadMoreLedger || ledgerLoading}
                onClick={() => void loadLedgerPage({ offset: ledgerOffset, append: true })}
              >
                Load more ledger
              </RippleButton>
              <RippleButton
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 font-semibold disabled:opacity-50"
                disabled={!canLoadMorePayments || paymentsLoading}
                onClick={() => void loadPaymentsPage({ offset: paymentsOffset, append: true })}
              >
                Load more payments
              </RippleButton>
            </div>
          ) : null}
        </div>

        {!isPrivileged ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
            You can view the organization balance here, but the combined transactions feed is restricted.
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-800">Combined feed</div>
              <div className="text-xs text-gray-500">
                {merged.length} loaded
                {(ledgerLoading || paymentsLoading) ? " • Loading…" : ""}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">When</th>
                    <th className="text-left font-semibold px-4 py-3">Type</th>
                    <th className="text-left font-semibold px-4 py-3">Details</th>
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-right font-semibold px-4 py-3">Credits</th>
                    <th className="text-right font-semibold px-4 py-3">Money</th>
                    <th className="text-left font-semibold px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {merged.length === 0 && !ledgerLoading && !paymentsLoading ? (
                    <tr>
                      <td className="px-4 py-8 text-gray-500" colSpan={7}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : null}
                  {merged.map((r) => {
                    const credits = Number(r.creditsDelta || 0);
                    return (
                      <tr key={`${r.kind}-${r.id}`} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          <span className="text-xs font-mono text-gray-500 mr-2">{r.kind}</span>
                          {r.title}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.subtitle}</td>
                        <td className="px-4 py-3 text-gray-700">{r.status || "—"}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${
                            credits < 0 ? "text-red-700" : "text-emerald-800"
                          }`}
                        >
                          {credits > 0 ? `+${credits.toLocaleString()}` : credits < 0 ? credits.toLocaleString() : "0"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800 tabular-nums">{r.money || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate" title={r.reference || ""}>
                          {r.reference || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageSectionCard>
  );
}

