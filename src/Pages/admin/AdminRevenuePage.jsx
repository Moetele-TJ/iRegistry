import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Coins, RefreshCw, Users, List } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { formatMoneyAmount } from "../../lib/formatBWP.js";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toISODateOnlyLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDayLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDaysLocal(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Monday-based week (Mon..Sun)
function startOfWeekLocal(d) {
  const x = startOfDayLocal(d);
  const day = x.getDay(); // 0 Sun ... 6 Sat
  const diff = (day + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  return addDaysLocal(x, -diff);
}

function endOfWeekLocal(d) {
  const s = startOfWeekLocal(d);
  return addDaysLocal(s, 6);
}

function startOfMonthLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonthLocal(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 0, 0, 0, 0);
}

function startOfYearLocal(d) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYearLocal(d) {
  return new Date(d.getFullYear(), 11, 31, 0, 0, 0, 0);
}

export default function AdminRevenuePage() {
  const { addToast } = useToast();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [users, setUsers] = useState([]);
  const [cashierId, setCashierId] = useState("");
  const [channel, setChannel] = useState("BOTH"); // CASHIER | ONLINE | BOTH
  const [quickDate, setQuickDate] = useState("TODAY");
  const [showTransactions] = useState(true);
  const didAutoRun = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const { data, error } = await invokeWithAuth("list-cashier-actors");
        if (cancelled) return;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load users");
        setUsers(data.cashiers || []);
      } catch (e) {
        addToast({ type: "error", message: e.message || "Failed to load users" });
        setUsers([]);
      }
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("revenue-report", {
        body: {
          from,
          to,
          cashier_user_id: channel === "ONLINE" ? null : (cashierId || null),
          channels: channel === "BOTH" ? ["CASHIER", "ONLINE"] : [channel],
          include_transactions: showTransactions,
          limit: 500,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load report");
      setReport(data);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load report" });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, cashierId, channel, from, showTransactions, to]);

  function applyQuickDate(preset) {
    const now = new Date();
    const today = startOfDayLocal(now);

    let rangeFrom = today;
    let rangeTo = today;

    switch (preset) {
      case "TODAY":
        rangeFrom = today;
        rangeTo = today;
        break;
      case "YESTERDAY": {
        const y = addDaysLocal(today, -1);
        rangeFrom = y;
        rangeTo = y;
        break;
      }
      case "THIS_WEEK":
        rangeFrom = startOfWeekLocal(today);
        rangeTo = today;
        break;
      case "LAST_WEEK": {
        const last = addDaysLocal(today, -7);
        rangeFrom = startOfWeekLocal(last);
        rangeTo = endOfWeekLocal(last);
        break;
      }
      case "THIS_MONTH":
        rangeFrom = startOfMonthLocal(today);
        rangeTo = today;
        break;
      case "LAST_MONTH": {
        const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        rangeFrom = startOfMonthLocal(last);
        rangeTo = endOfMonthLocal(last);
        break;
      }
      case "THIS_YEAR":
        rangeFrom = startOfYearLocal(today);
        rangeTo = today;
        break;
      case "LAST_YEAR": {
        const last = new Date(today.getFullYear() - 1, 0, 1);
        rangeFrom = startOfYearLocal(last);
        rangeTo = endOfYearLocal(last);
        break;
      }
      default:
        return;
    }

    setFrom(toISODateOnlyLocal(rangeFrom));
    setTo(toISODateOnlyLocal(rangeTo));
  }

  useEffect(() => {
    applyQuickDate(quickDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto-run any time a filter changes (debounced slightly to avoid spam while typing/picking).
    const t = window.setTimeout(() => {
      didAutoRun.current = true;
      void load();
    }, didAutoRun.current ? 200 : 0);
    return () => window.clearTimeout(t);
  }, [cashierId, channel, from, load, to]);

  const rows = useMemo(() => {
    const by = report?.totals?.by_currency || {};
    return Object.entries(by).map(([cur, v]) => ({
      currency: cur,
      amount: v.amount,
      count: v.count,
    }));
  }, [report]);

  const totalCount = report?.totals?.count ?? 0;
  const tx = report?.transactions || [];
  const byChannel = report?.totals?.by_channel || {};
  const byChCur = report?.totals?.by_channel_currency || {};

  const breakdownRows = useMemo(() => {
    const picks = [
      { channel: "CASHIER", label: "Cashier" },
      { channel: "ONLINE", label: "Online" },
    ];
    return picks
      .filter((p) => byChannel?.[p.channel])
      .map((p) => {
        const totals = byChannel[p.channel] || { amount: 0, count: 0 };
        const curMap = byChCur?.[p.channel] || {};
        const curList = Object.entries(curMap).map(([cur, v]) => ({
          currency: cur,
          amount: v?.amount ?? 0,
          count: v?.count ?? 0,
        }));
        return { ...p, totals, currencies: curList };
      });
  }, [byChannel, byChCur]);

  return (
    <PageSectionCard
      maxWidthClass="max-w-6xl"
      title="Revenue"
      subtitle="Confirmed top-ups by date, with breakdown of Cashier vs Online."
      icon={<Coins className="w-6 h-6 text-iregistrygreen shrink-0" />}
    >
      <div className="p-4 sm:p-6 space-y-6">
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            Cashier actor
          </label>
          <select
            value={cashierId}
            onChange={(e) => setCashierId(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
            disabled={channel === "ONLINE"}
          >
            <option value="">All cashier actors</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {String(u.first_name || "").trim()} {String(u.last_name || "").trim()} ({u.id_number || u.email || u.phone || u.id})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-600">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm">
            <option value="CASHIER">Cashier</option>
            <option value="ONLINE">Online</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-600">Quick date</label>
          <select
            value={quickDate}
            onChange={(e) => {
              const v = e.target.value;
              setQuickDate(v);
              applyQuickDate(v);
            }}
            className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
          >
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="LAST_WEEK">Last Week</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="LAST_YEAR">Last Year</option>
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-400" />
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setQuickDate("");
              setFrom(e.target.value);
            }}
            className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-400" />
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setQuickDate("");
              setTo(e.target.value);
            }}
            className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <RippleButton
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Loading…" : "Refresh"}
        </RippleButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-6">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Transactions</div>
          <div className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-6">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Totals</div>
          {rows.length === 0 ? (
            <div className="text-sm text-gray-400 mt-2">—</div>
          ) : (
            <div className="mt-2 space-y-1">
              {rows.map((r) => (
                <div key={r.currency} className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">{r.currency}</div>
                  <div className="text-sm font-semibold text-gray-900 tabular-nums">{formatMoneyAmount(r.currency, r.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-6">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Breakdown</div>
          {breakdownRows.length === 0 ? (
            <div className="text-sm text-gray-400 mt-2">—</div>
          ) : (
            <div className="mt-2 space-y-3">
              {breakdownRows.map((b) => (
                <div key={b.channel} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">{b.label}</div>
                    <div className="text-xs text-gray-500 tabular-nums">{b.totals.count} tx</div>
                  </div>
                  {b.currencies?.length ? (
                    <div className="mt-1 space-y-1">
                      {b.currencies.map((c) => (
                        <div key={c.currency} className="flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-600">{c.currency}</div>
                          <div className="text-xs font-semibold text-gray-900 tabular-nums">
                            {formatMoneyAmount(c.currency, c.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-1">—</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTransactions ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <List size={16} className="text-gray-400" />
              Transactions
            </div>
            <div className="text-xs text-gray-400">{tx.length} shown</div>
          </div>
          {tx.length === 0 ? (
            <div className="text-sm text-gray-500">No transactions for this filter.</div>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Confirmed</th>
                    <th className="text-left font-semibold px-4 py-3">User</th>
                    <th className="text-left font-semibold px-4 py-3">Channel</th>
                    <th className="text-left font-semibold px-4 py-3">Amount</th>
                    <th className="text-left font-semibold px-4 py-3">Credits</th>
                    <th className="text-left font-semibold px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tx.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {p.confirmed_at ? new Date(p.confirmed_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        <div className="font-medium">
                          {p.users
                            ? `${String(p.users.first_name || "").trim()} ${String(p.users.last_name || "").trim()}`.trim() ||
                              p.users.email ||
                              p.user_id
                            : (p.user_id || "—")}
                        </div>
                        {p.users ? (
                          <div className="text-xs text-gray-500 truncate">
                            {p.users.email || p.users.phone || p.users.id_number || ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.channel}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatMoneyAmount(p.currency, p.amount)}</td>
                      <td className="px-4 py-3 text-gray-700 tabular-nums">{p.credits_granted ?? 0}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.channel === "CASHIER" ? (p.receipt_no || "—") : (p.provider_reference || p.provider || "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
      </div>
    </PageSectionCard>
  );
}

