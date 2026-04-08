import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Coins, RefreshCw, Users } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar.jsx";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(currency, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "BWP",
      currencyDisplay: "symbol",
    }).format(n);
  } catch {
    return `${currency || ""} ${n}`;
  }
}

export default function AdminRevenuePage() {
  useAdminSidebar();
  const { addToast } = useToast();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [users, setUsers] = useState([]);
  const [cashierId, setCashierId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const { data, error } = await invokeWithAuth("list-users");
        if (cancelled) return;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load users");
        const cashiers = (data.users || []).filter((u) => String(u.role || "").toLowerCase() === "cashier");
        setUsers(cashiers);
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

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("revenue-report", {
        body: { from, to, cashier_user_id: cashierId || null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load report");
      setReport(data);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load report" });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const by = report?.totals?.by_currency || {};
    return Object.entries(by).map(([cur, v]) => ({
      currency: cur,
      amount: v.amount,
      count: v.count,
    }));
  }, [report]);

  const totalCount = report?.totals?.count ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Coins className="w-6 h-6 text-iregistrygreen" />
          Cashier revenue
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a cashier and date range to compute confirmed cashier top-ups.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <Users size={14} className="text-gray-400" />
            Cashier
          </label>
          <select
            value={cashierId}
            onChange={(e) => setCashierId(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All cashiers</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {String(u.first_name || "").trim()} {String(u.last_name || "").trim()} ({u.id_number || u.email || u.phone || u.id})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-400" />
            From
          </label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <CalendarDays size={14} className="text-gray-400" />
            To
          </label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" />
        </div>
        <RippleButton
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Loading…" : "Run report"}
        </RippleButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Transactions</div>
          <div className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{totalCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">Totals</div>
          {rows.length === 0 ? (
            <div className="text-sm text-gray-400 mt-2">—</div>
          ) : (
            <div className="mt-2 space-y-1">
              {rows.map((r) => (
                <div key={r.currency} className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">{r.currency}</div>
                  <div className="text-sm font-semibold text-gray-900 tabular-nums">{fmtMoney(r.currency, r.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

