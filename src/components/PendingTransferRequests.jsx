//  src/components/PendingTransferRequests.jsx
import { usePendingTransfers } from "../hooks/usePendingTransfers";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { attachBillingToError } from "../lib/billingUx.js";
import { useTaskPricing } from "../hooks/useTaskPricing.js";
import { useBillingErrorMessage } from "../hooks/useBillingErrorMessage.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import RippleButton from "./RippleButton";
import { useModal } from "../contexts/ModalContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useState } from "react";

export default function PendingTransferRequests() {
  const { data, loading, refresh } = usePendingTransfers();
  const { confirm } = useModal();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { getCost } = useTaskPricing();
  const formatBilling = useBillingErrorMessage();
  const [busyId, setBusyId] = useState("");

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-sm text-gray-400">Loading transfer requests...</div>
      </div>
    );
  }

  if (!data.length) return null;

  async function handleDecision(id, decision) {
    if (busyId) return;
    let approveMsg =
      "Approving will transfer ownership to the requester and may consume credits from your account.";
    if (decision === "APPROVED") {
      const cost = getCost("TRANSFER_OWNERSHIP");
      const bal = Number(user?.credit_balance ?? 0);
      if (cost != null) {
        approveMsg += ` This step costs ${cost} credits. Your balance: ${bal}.`;
        if (bal < cost) {
          approveMsg += ` You need ${cost - bal} more credits — see Credit pricing or visit a cashier.`;
        }
      }
    }

    const ok = await confirm({
      title: "Confirm",
      message:
        decision === "APPROVED"
          ? approveMsg
          : "Reject this transfer request?",
      confirmLabel: decision === "APPROVED" ? "Approve" : "Reject",
      cancelLabel: "Cancel",
      danger: decision !== "APPROVED",
    }).catch(() => false);
    if (!ok) return;

    setBusyId(String(id));
    try {
      const { data: res, error } = await invokeWithAuth("review-transfer-request", {
        body: { request_id: id, decision },
      });

      if (error || !res?.success) {
        const msg = res?.message || error?.message || "Transfer action failed";
        const e = attachBillingToError(new Error(msg), res);
        addToast({
          type: "error",
          message: res?.billing?.required ? formatBilling(e) : msg,
        });
        return;
      }

      addToast({
        type: "success",
        message: decision === "APPROVED" ? "Transfer approved." : "Transfer rejected.",
      });
      await refresh();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm uppercase tracking-wide text-gray-500">
          Pending Transfer Requests
        </div>

        <div className="text-xs text-gray-400">
          {data.length} pending
        </div>
      </div>

      <div className="space-y-4">
        {data.map((r) => (
          <div
            key={r.id}
            className="border rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition"
          >
            <div className="font-medium text-gray-800">
              {r.items?.name}
            </div>

            <div className="text-sm text-gray-500">
              Requested by {r.users?.first_name} {r.users?.last_name}
            </div>

            {r.message && (
              <div className="text-sm text-gray-600 mt-2 italic">
                "{r.message}"
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <RippleButton
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                onClick={() => handleDecision(r.id, "APPROVED")}
                disabled={busyId === String(r.id)}
              >
                {busyId === String(r.id) ? "Working..." : "Approve"}
              </RippleButton>

              <RippleButton
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                onClick={() => handleDecision(r.id, "REJECTED")}
                disabled={busyId === String(r.id)}
              >
                {busyId === String(r.id) ? "Working..." : "Reject"}
              </RippleButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}