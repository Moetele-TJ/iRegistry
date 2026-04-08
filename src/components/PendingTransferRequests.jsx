//  src/components/PendingTransferRequests.jsx
import { usePendingTransfers } from "../hooks/usePendingTransfers";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import RippleButton from "./RippleButton";
import { useModal } from "../contexts/ModalContext.jsx";

export default function PendingTransferRequests() {
  const { data, loading, refresh } = usePendingTransfers();
  const { confirm } = useModal();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="text-sm text-gray-400">Loading transfer requests...</div>
      </div>
    );
  }

  if (!data.length) return null;

  async function handleDecision(id, decision) {
    const ok = await confirm({
      title: "Confirm",
      message:
        decision === "APPROVED"
          ? "Approving will transfer ownership and may consume credits."
          : "Reject this transfer request?",
      confirmLabel: decision === "APPROVED" ? "Approve" : "Reject",
      cancelLabel: "Cancel",
      danger: decision !== "APPROVED",
    }).catch(() => false);
    if (!ok) return;

    await invokeWithAuth("review-transfer-request", {
      body: { request_id: id, decision },
    });
    refresh();
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
              >
                Approve
              </RippleButton>

              <RippleButton
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                onClick={() => handleDecision(r.id, "REJECTED")}
              >
                Reject
              </RippleButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}