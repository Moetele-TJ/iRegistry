import { useEffect, useMemo, useState } from "react";
import { Search, RotateCcw, ReceiptText, Filter } from "lucide-react";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import RippleButton from "../../components/RippleButton.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAdminSidebar } from "../../hooks/useAdminSidebar.jsx";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.phone || u?.id || "—";
}

function fmtMoney(currency, amount) {
  if (amount == null) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
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

export default function AdminTransactionsPage({ canReverse = true, showSidebar = true } = {}) {
  useAdminSidebar({ visible: showSidebar });
  const { addToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [reversingId, setReversingId] = useState("");
  const [reverseReason, setReverseReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const { data, error } = await invokeWithAuth("list-users");
        if (cancelled) return;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load users");
        setUsers(data.users || []);
      } catch (e) {
        addToast({ type: "error", message: e.message || "Failed to load users" });
        setUsers([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const filteredUsers = useMemo(() => {
    const q = String(userQuery || "").trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return (users || []).filter((u) => {
      const hay = [
        displayName(u),
        u?.email || "",
        u?.phone || "",
        u?.id_number || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, userQuery]);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)) || null,
    [users, selectedUserId],
  );

  async function loadPayments(userId) {
    setLoadingPayments(true);
    try {
      const { data, error } = await invokeWithAuth("list-payments", {
        body: {
          user_id: userId || null,
          limit: 100,
          offset: 0,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load payments");
      setPayments(data.payments || []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load payments" });
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }

  useEffect(() => {
    void loadPayments(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  async function reversePayment(paymentId) {
    if (!canReverse) return;
    const reason = String(reverseReason || "").trim();
    if (!reason) {
      addToast({ type: "error", message: "Enter a reversal reason." });
      return;
    }
    setReversingId(paymentId);
    try {
      const { data, error } = await invokeWithAuth("reverse-payment", {
        body: { payment_id: paymentId, reason },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Could not reverse payment");
      addToast({ type: "success", message: "Transaction reversed successfully." });
      setReverseReason("");
      await loadPayments(selectedUserId);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Could not reverse payment" });
    } finally {
      setReversingId("");
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ReceiptText className="w-6 h-6 text-iregistrygreen" />
          Transactions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View payments and reverse a confirmed top-up (only if the user still has enough unspent credits).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              Filter by user
            </div>
            <div className="text-xs text-gray-400">{loadingUsers ? "Loading…" : `${users.length} users`}</div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="w-full outline-none text-sm"
              placeholder="Search user…"
            />
          </div>

          <div className="max-h-[420px] overflow-auto divide-y rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => setSelectedUserId("")}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedUserId ? "" : "bg-emerald-50/60"}`}
            >
              <div className="font-medium text-gray-900">All users</div>
              <div className="text-xs text-gray-500">Show latest transactions across all users</div>
            </button>
            {filteredUsers.map((u) => {
              const active = String(u.id) === String(selectedUserId);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(String(u.id))}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? "bg-emerald-50/60" : ""}`}
                >
                  <div className="font-medium text-gray-900 truncate">{displayName(u)}</div>
                  <div className="text-xs text-gray-500 truncate">
                    Balance: <span className="tabular-nums">{Number(u?.credit_balance ?? 0)}</span> credits
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-800">Payments</div>
              <div className="text-xs text-gray-500 mt-1">
                {selectedUser ? `For ${displayName(selectedUser)}` : "Latest payments"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canReverse ? (
                <input
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="border rounded-xl px-3 py-2 text-sm w-64"
                  placeholder="Reversal reason (required)"
                />
              ) : null}
              <RippleButton
                className="px-3 py-2 rounded-xl border bg-white text-sm"
                onClick={() => void loadPayments(selectedUserId)}
                disabled={loadingPayments}
              >
                Refresh
              </RippleButton>
            </div>
          </div>

          {loadingPayments ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="text-sm text-gray-500">No transactions found.</div>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Date</th>
                    <th className="text-left font-semibold px-4 py-3">User</th>
                    <th className="text-left font-semibold px-4 py-3">Channel</th>
                    <th className="text-left font-semibold px-4 py-3">Amount</th>
                    <th className="text-left font-semibold px-4 py-3">Credits</th>
                    <th className="text-left font-semibold px-4 py-3">Status</th>
                    <th className="text-right font-semibold px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => {
                    const reversible = p.status === "CONFIRMED" && !p.reversed_at;
                    const who = p.users || null;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          <div className="font-medium">{who ? displayName(who) : p.user_id}</div>
                          {p.receipt_no ? <div className="text-xs text-gray-500">Receipt: {p.receipt_no}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.channel}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtMoney(p.currency, p.amount)}</td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums">{p.credits_granted ?? 0}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              p.status === "CONFIRMED"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                : p.status === "FAILED"
                                  ? "bg-red-50 text-red-700 border border-red-100"
                                  : "bg-gray-50 text-gray-700 border border-gray-100"
                            }`}
                          >
                            {p.reversed_at ? "REVERSED" : p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canReverse ? (
                            <RippleButton
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm disabled:opacity-50"
                              disabled={!reversible || reversingId === p.id}
                              onClick={() => void reversePayment(p.id)}
                            >
                              <RotateCcw size={16} />
                              {reversingId === p.id ? "Reversing…" : "Reverse"}
                            </RippleButton>
                          ) : (
                            <span className="text-xs text-gray-400">Read only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

