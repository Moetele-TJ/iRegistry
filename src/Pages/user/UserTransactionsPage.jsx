import { useEffect, useState } from "react";
import { CreditCard, ReceiptText, Trash2 } from "lucide-react";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import RippleButton from "../../components/RippleButton.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatMoneyAmount } from "../../lib/formatBWP.js";
import PageSectionCard from "../shared/PageSectionCard.jsx";

export default function UserTransactionsPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { refreshUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);

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

  function startOnlinePayment() {
    addToast({
      type: "info",
      message:
        "Online payment isn't available yet. Complete this top-up in person with staff, or check back soon.",
    });
  }

  async function confirmPay() {
    const ok = await confirm({
      title: "Pay online?",
      message:
        "Online checkout is not available yet—this will only remind you how to complete payment in person for now.",
      confirmLabel: "Continue",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;
    startOnlinePayment();
  }

  async function confirmDeletePending() {
    const ok = await confirm({
      title: "Delete pending top-up?",
      message:
        "This removes your pending top-up request. You can submit a new one later. Nothing is refunded because no payment was taken yet.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setActingId("cancel");
    try {
      const { data, error } = await invokeWithAuth("user-pending-topup", {
        body: { action: "cancel" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not cancel");
      }
      addToast({ type: "success", message: "Pending top-up cancelled." });
      await refreshUser();
      await load();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Could not cancel" });
    } finally {
      setActingId(null);
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-6xl"
      title="Transactions"
      subtitle="Your credit top-ups and payment history."
      icon={<ReceiptText className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <RippleButton
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </RippleButton>
      }
    >
      {loading ? (
        <div className="px-5 py-6 text-sm text-gray-500">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-500">No transactions yet.</div>
      ) : (
        <div className="overflow-x-auto px-3 sm:px-4">
          <table className="text-sm w-max max-w-full border-collapse">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold pl-0 pr-2 py-2">Date</th>
                <th className="text-left font-semibold px-2 py-2">Channel</th>
                <th className="text-left font-semibold px-2 py-2">Amount</th>
                <th className="text-left font-semibold px-2 py-2">Credits</th>
                <th className="text-left font-semibold px-2 py-2">Status</th>
                <th className="text-right font-semibold pl-2 pr-0 py-2 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const showPendingActions = p.status === "PENDING" && !p.reversed_at;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="pl-0 pr-2 py-2 text-gray-700 whitespace-nowrap">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{p.channel}</td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{formatMoneyAmount(p.currency, p.amount)}</td>
                    <td className="px-2 py-2 text-gray-700 tabular-nums whitespace-nowrap">{p.credits_granted ?? 0}</td>
                    <td className="px-2 py-2">
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
                    <td className="pl-2 pr-0 py-2 text-right">
                      {showPendingActions ? (
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <RippleButton
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-iregistrygreen text-white text-xs font-semibold disabled:opacity-60"
                            disabled={loading || actingId != null}
                            title="Pay online when checkout is available"
                            onClick={() => void confirmPay()}
                          >
                            <CreditCard className="w-3.5 h-3.5 shrink-0" />
                            Pay
                          </RippleButton>
                          <RippleButton
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-white text-xs font-semibold disabled:opacity-60"
                            disabled={loading || actingId != null}
                            onClick={() => void confirmDeletePending()}
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            Delete
                          </RippleButton>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageSectionCard>
  );
}

