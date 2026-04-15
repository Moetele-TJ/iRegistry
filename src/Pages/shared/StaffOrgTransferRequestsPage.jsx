import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.id || "—";
}

export default function StaffOrgTransferRequestsPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);

  const rows = useMemo(() => requests || [], [requests]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("list-org-item-transfer-requests", {
        body: { status: "OPEN", limit: 200, offset: 0 },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e) {
      setError(e.message || "Failed to load requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeRequest(r, action) {
    const ok = await confirm({
      title: action === "COMPLETE" ? "Complete transfer?" : "Reject transfer?",
      message:
        action === "COMPLETE"
          ? "This will move the item out of the organization and into the target user's personal ownership."
          : "This will reject the request. The item will remain in the organization.",
      confirmLabel: action === "COMPLETE" ? "Complete" : "Reject",
      cancelLabel: "Cancel",
      danger: action === "REJECT",
    }).catch(() => false);
    if (!ok) return;

    setBusyId(r.id);
    try {
      const { data, error } = await invokeWithAuth("staff-complete-org-item-transfer-request", {
        body: { request_id: r.id, action, note: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: action === "COMPLETE" ? "Transfer completed." : "Request rejected." });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBusyId("");
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization transfer requests"
      subtitle="Staff-assisted transfers requested by organization administrators."
      actions={
        <RippleButton
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </RippleButton>
      }
    >
      <div className="p-4 sm:p-6 space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Organization</th>
                <th className="text-left font-semibold px-4 py-3">Item</th>
                <th className="text-left font-semibold px-4 py-3">Target user</th>
                <th className="text-left font-semibold px-4 py-3">Reason</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-gray-500" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-gray-500" colSpan={5}>
                    No open requests.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-900 font-semibold">{r.organization?.name || r.org_id}</td>
                    <td className="px-4 py-3 text-gray-800">{r.item?.name || r.item_id}</td>
                    <td className="px-4 py-3 text-gray-800">{displayName(r.target_user)}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[360px] truncate" title={r.reason || ""}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <RippleButton
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-iregistrygreen text-white text-xs font-semibold disabled:opacity-60"
                          disabled={busyId === r.id}
                          onClick={() => void completeRequest(r, "COMPLETE")}
                        >
                          <Check size={14} />
                          Complete
                        </RippleButton>
                        <RippleButton
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-xs font-semibold disabled:opacity-60"
                          disabled={busyId === r.id}
                          onClick={() => void completeRequest(r, "REJECT")}
                        >
                          <X size={14} />
                          Reject
                        </RippleButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageSectionCard>
  );
}

