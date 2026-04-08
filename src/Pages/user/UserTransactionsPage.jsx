import { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import RippleButton from "../../components/RippleButton.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";

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

export default function UserTransactionsPage() {
  const { addToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-my-payments", {
        body: { limit: 100, offset: 0 },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load transactions");
      setPayments(data.payments || []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load transactions" });
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-iregistrygreen" />
            Transactions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Your credit top-ups and payment history.</p>
        </div>
        <RippleButton
          className="px-3 py-2 rounded-xl border bg-white text-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </RippleButton>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
          No transactions yet.
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Date</th>
                <th className="text-left font-semibold px-4 py-3">Channel</th>
                <th className="text-left font-semibold px-4 py-3">Amount</th>
                <th className="text-left font-semibold px-4 py-3">Credits</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.channel}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtMoney(p.currency, p.amount)}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">{p.credits_granted ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.reversed_at
                          ? "bg-gray-50 text-gray-700 border border-gray-100"
                          : p.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            : p.status === "FAILED"
                              ? "bg-red-50 text-red-700 border border-red-100"
                              : "bg-gray-50 text-gray-700 border border-gray-100"
                      }`}
                    >
                      {p.reversed_at ? "REVERSED" : p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

