import { useEffect, useState } from "react";
import { CreditCard, ReceiptText, Trash2, Building2, User } from "lucide-react";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import RippleButton from "../../components/RippleButton.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatMoneyAmount } from "../../lib/formatBWP.js";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function walletLabel(p) {
  if (p?.wallet === "org" && p?.organization?.name) {
    return String(p.organization.name).trim() || "Organization";
  }
  if (p?.wallet === "org") return "Organization";
  return "Personal";
}

function TransactionStatusBadge({ payment: p }) {
  const label = p.reversed_at ? "REVERSED" : p.status;
  const tone = p.reversed_at
    ? "bg-gray-50 text-gray-700 border border-gray-100"
    : p.status === "CONFIRMED"
      ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
      : p.status === "FAILED"
        ? "bg-red-50 text-red-700 border border-red-100"
        : "bg-gray-50 text-gray-700 border border-gray-100";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>
  );
}

export default function UserTransactionsPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { refreshUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [scope, setScope] = useState("both");

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-my-payments", {
        body: { limit: 100, offset: 0, scope },
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
  }, [scope]);

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
      subtitle="Personal wallet and organization top-ups you have access to."
      icon={<ReceiptText className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-xs font-semibold shadow-sm">
            {[
              { id: "both", label: "All" },
              { id: "user", label: "Personal" },
              { id: "org", label: "Organization" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  scope === opt.id
                    ? "bg-iregistrygreen text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </RippleButton>
        </div>
      }
    >
      {loading ? (
        <div className="px-5 py-6 text-sm text-gray-500">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-500">
          {scope === "org"
            ? "No organization transactions yet, or you are not a member of any organization."
            : "No transactions yet."}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden px-4 pb-4 sm:px-5 space-y-3">
            {payments.map((p) => {
              const rowKey = `${p.wallet || "user"}-${p.id}`;
              const showPendingActions =
                p.wallet !== "org" && p.status === "PENDING" && !p.reversed_at;
              return (
                <article
                  key={rowKey}
                  className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</p>
                      <p className="text-sm text-gray-900 mt-0.5 break-words">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </p>
                    </div>
                    <TransactionStatusBadge payment={p} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    {p.wallet === "org" ? (
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" aria-hidden />
                    ) : (
                      <User className="w-3.5 h-3.5 shrink-0 text-gray-500" aria-hidden />
                    )}
                    <span className="font-medium text-gray-800">{walletLabel(p)}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">Channel</dt>
                      <dd className="text-gray-800 font-medium mt-0.5">{p.channel}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Credits</dt>
                      <dd className="text-gray-800 font-medium tabular-nums mt-0.5">{p.credits_granted ?? 0}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-500">Amount</dt>
                      <dd className="text-gray-800 font-medium mt-0.5 tabular-nums">
                        {formatMoneyAmount(p.currency, p.amount)}
                      </dd>
                    </div>
                  </dl>
                  {showPendingActions ? (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100/90">
                      <RippleButton
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60 w-full"
                        disabled={loading || actingId != null}
                        title="Pay online when checkout is available"
                        onClick={() => void confirmPay()}
                      >
                        <CreditCard className="w-4 h-4 shrink-0" />
                        Pay
                      </RippleButton>
                      <RippleButton
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 text-red-700 bg-white text-sm font-semibold disabled:opacity-60 w-full"
                        disabled={loading || actingId != null}
                        onClick={() => void confirmDeletePending()}
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        Delete
                      </RippleButton>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {/* md+: table */}
          <div className="hidden md:block overflow-x-auto px-4 sm:px-5">
          <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-3 py-2.5">Date</th>
                <th className="text-left font-semibold px-3 py-2.5">Wallet</th>
                <th className="text-left font-semibold px-3 py-2.5">Channel</th>
                <th className="text-left font-semibold px-3 py-2.5">Amount</th>
                <th className="text-left font-semibold px-3 py-2.5">Credits</th>
                <th className="text-left font-semibold px-3 py-2.5">Status</th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => {
                const rowKey = `${p.wallet || "user"}-${p.id}`;
                const showPendingActions =
                  p.wallet !== "org" && p.status === "PENDING" && !p.reversed_at;
                return (
                  <tr key={rowKey} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap align-middle">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 align-middle">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        {p.wallet === "org" ? (
                          <Building2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" aria-hidden />
                        ) : (
                          <User className="w-3.5 h-3.5 shrink-0 text-gray-500" aria-hidden />
                        )}
                        <span className="truncate font-medium">{walletLabel(p)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap align-middle">{p.channel}</td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap align-middle">{formatMoneyAmount(p.currency, p.amount)}</td>
                    <td className="px-3 py-2.5 text-gray-700 tabular-nums whitespace-nowrap align-middle">{p.credits_granted ?? 0}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <TransactionStatusBadge payment={p} />
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      {showPendingActions ? (
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
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
        </>
      )}
    </PageSectionCard>
  );
}

