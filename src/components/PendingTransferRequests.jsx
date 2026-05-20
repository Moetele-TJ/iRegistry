//  src/components/PendingTransferRequests.jsx
import { usePendingTransfers } from "../hooks/usePendingTransfers";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { attachBillingToError, willTransferApproveChargeOwner } from "../lib/billingUx.js";
import { useTaskPricing } from "../hooks/useTaskPricing.js";
import { useBillingErrorMessage } from "../hooks/useBillingErrorMessage.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import RippleButton from "./RippleButton";
import { useModal } from "../contexts/ModalContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { useState } from "react";

function ownerName(u) {
  if (!u) return "the owner";
  const n = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return n || "the owner";
}

function requesterName(u) {
  if (!u) return "Someone";
  const n = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return n || "Someone";
}

function formatExpires(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export default function PendingTransferRequests({ showWhenEmpty = false } = {}) {
  const { incoming, outgoing, loading, refresh } = usePendingTransfers();
  const { confirm } = useModal();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { getCost } = useTaskPricing();
  const formatBilling = useBillingErrorMessage();
  const [busyId, setBusyId] = useState("");

  const hasAny = incoming.length > 0 || outgoing.length > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-sm text-gray-400">Loading transfer requests...</div>
      </div>
    );
  }

  if (!hasAny && !showWhenEmpty) return null;

  async function handleOwnerDecision(id, decision) {
    if (busyId) return;
    let approveMsg =
      "Approving will transfer ownership to the requester and may consume credits from your account.";
    if (decision === "APPROVED") {
      const approverPays = willTransferApproveChargeOwner(user?.role);
      if (!approverPays) {
        approveMsg +=
          " As an admin or cashier, approving does not deduct credits from your account.";
      } else {
        const cost = getCost("TRANSFER_OWNERSHIP");
        const bal = Number(user?.credit_balance ?? 0);
        if (cost != null) {
          approveMsg += ` This step costs ${cost} credits. Your balance: ${bal}.`;
          if (bal < cost) {
            approveMsg += ` You need ${cost - bal} more credits — see Credit pricing or visit a cashier.`;
          }
        }
      }
    }

    const ok = await confirm({
      title: decision === "APPROVED" ? "Approve transfer?" : "Reject transfer?",
      message:
        decision === "APPROVED"
          ? approveMsg
          : "Reject this transfer request? The requester will not receive ownership.",
      confirmLabel: decision === "APPROVED" ? "Approve" : "Reject",
      cancelLabel: "Back",
      danger: decision !== "APPROVED",
    }).catch(() => false);
    if (!ok) return;

    setBusyId(`owner:${id}`);
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

  async function handleCancelOutgoing(id) {
    if (busyId) return;

    const ok = await confirm({
      title: "Cancel transfer request?",
      message:
        "Withdraw your ownership transfer request. The item owner will no longer see it.",
      confirmLabel: "Cancel request",
      cancelLabel: "Keep request",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setBusyId(`cancel:${id}`);
    try {
      const { data: res, error } = await invokeWithAuth("cancel-transfer-request", {
        body: { request_id: id },
      });

      if (error || !res?.success) {
        addToast({
          type: "error",
          message: res?.message || error?.message || "Could not cancel request",
        });
        return;
      }

      addToast({ type: "success", message: "Transfer request cancelled." });
      await refresh();
    } finally {
      setBusyId("");
    }
  }

  if (!hasAny && showWhenEmpty) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
        <div className="text-sm uppercase tracking-wide text-gray-500">
          Individual transfer requests
        </div>
        <p className="text-sm text-gray-500">
          No pending individual transfer requests. Requests you send or receive on your items appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm uppercase tracking-wide text-gray-500">
          {showWhenEmpty ? "Individual transfer requests" : "Transfer requests"}
        </div>
        <div className="text-xs text-gray-400">
          {incoming.length} for you · {outgoing.length} sent
        </div>
      </div>

      {incoming.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            On your items — approve or reject
          </h3>
          <div className="space-y-4">
            {incoming.map((r) => {
              const busy = busyId === `owner:${r.id}`;
              const exp = formatExpires(r.expires_at);
              return (
                <div
                  key={r.id}
                  className="border rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <div className="font-medium text-gray-800">{r.items?.name || "Item"}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    Requested by {requesterName(r.users)}
                  </div>
                  {exp ? (
                    <div className="text-xs text-gray-400 mt-1">Expires {exp}</div>
                  ) : null}
                  {r.message ? (
                    <div className="text-sm text-gray-600 mt-2 italic">&ldquo;{r.message}&rdquo;</div>
                  ) : null}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <RippleButton
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      onClick={() => handleOwnerDecision(r.id, "APPROVED")}
                      disabled={busy}
                    >
                      {busy ? "Working…" : "Approve"}
                    </RippleButton>
                    <RippleButton
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      onClick={() => handleOwnerDecision(r.id, "REJECTED")}
                      disabled={busy}
                    >
                      {busy ? "Working…" : "Reject"}
                    </RippleButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Requests you sent — cancel if needed
          </h3>
          <div className="space-y-4">
            {outgoing.map((r) => {
              const busy = busyId === `cancel:${r.id}`;
              const exp = formatExpires(r.expires_at);
              return (
                <div
                  key={r.id}
                  className="border rounded-xl p-4 bg-blue-50/50 border-blue-100 hover:bg-blue-50 transition"
                >
                  <div className="font-medium text-gray-800">{r.items?.name || "Item"}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    Waiting for {ownerName(r.users)} to respond
                  </div>
                  {exp ? (
                    <div className="text-xs text-gray-400 mt-1">Expires {exp}</div>
                  ) : null}
                  {r.message ? (
                    <div className="text-sm text-gray-600 mt-2 italic">&ldquo;{r.message}&rdquo;</div>
                  ) : null}
                  <div className="mt-4">
                    <RippleButton
                      className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
                      onClick={() => handleCancelOutgoing(r.id)}
                      disabled={busy}
                    >
                      {busy ? "Working…" : "Cancel request"}
                    </RippleButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {incoming.length === 0 && outgoing.length > 0 && !showWhenEmpty ? (
        <p className="text-xs text-gray-500">
          No incoming requests on your items right now.
        </p>
      ) : null}
    </div>
  );
}
