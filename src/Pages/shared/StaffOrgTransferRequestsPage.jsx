import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Info, RefreshCw, X } from "lucide-react";
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

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function StaffOrgTransferRequestsPage() {
  const { addToast } = useToast();
  const { confirm, alert } = useModal();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("OPEN");
  const [total, setTotal] = useState(null);
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const rows = useMemo(() => requests || [], [requests]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("list-org-item-transfer-requests", {
        body: { status, limit: pageSize, offset: page * pageSize },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setTotal(typeof data.total === "number" ? data.total : null);
    } catch (e) {
      setError(e.message || "Failed to load requests");
      setRequests([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

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

  function evidenceHref(evidence) {
    // Current evidence shape from upload-ownership-evidence: { fileId, type, uploadedAt, referenceId }
    const fileId = evidence?.fileId;
    if (!fileId || typeof fileId !== "string") return "";
    const base = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
    // fileId looks like: bucket/path/to/file
    return `${base}/storage/v1/object/public/${fileId}`;
  }

  async function showDetails(r) {
    const org = r.organization?.name || r.org_id;
    const item = r.item?.name || r.item_id;
    const target = displayName(r.target_user);
    const requestedBy = displayName(r.requested_by_user);
    const when = r.requested_at ? new Date(r.requested_at).toLocaleString() : "—";
    const reviewedAt = r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—";
    const completedAt = r.completed_at ? new Date(r.completed_at).toLocaleString() : "—";
    const href = evidenceHref(r.evidence);

    await alert({
      title: "Transfer request details",
      message: "Review details and evidence before completing.",
      confirmLabel: "Close",
      children: (
        <div className="space-y-2 text-sm text-gray-700">
          <div>
            <div className="text-xs text-gray-500">Organization</div>
            <div className="font-semibold text-gray-900">{org}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Item</div>
            <div className="font-semibold text-gray-900">{item}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Target user</div>
              <div className="font-semibold text-gray-900">{target}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Requested by</div>
              <div className="font-semibold text-gray-900">{requestedBy}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Requested at</div>
              <div className="font-semibold text-gray-900">{when}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="font-semibold text-gray-900">{r.status}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500">Reviewed at</div>
              <div className="font-semibold text-gray-900">{reviewedAt}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Completed at</div>
              <div className="font-semibold text-gray-900">{completedAt}</div>
            </div>
          </div>
          {r.review_note ? (
            <div>
              <div className="text-xs text-gray-500">Staff note</div>
              <div className="text-gray-900">{r.review_note}</div>
            </div>
          ) : null}
          <div>
            <div className="text-xs text-gray-500">Reason</div>
            <div className="text-gray-900">{r.reason || "—"}</div>
          </div>
          <div className="pt-1">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-emerald-800 hover:text-emerald-900 font-semibold"
              >
                <ExternalLink size={16} />
                Open evidence
              </a>
            ) : (
              <div className="inline-flex items-center gap-2 text-gray-500">
                <Info size={16} />
                No evidence link available
              </div>
            )}
          </div>
        </div>
      ),
    });
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

        <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <label className="text-xs text-gray-600">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setPage(0);
                setStatus(e.target.value);
              }}
              className="mt-1 w-full sm:w-[220px] border rounded-xl px-3 py-2 text-sm bg-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-500">
            {typeof total === "number" ? (
              <>
                Total: <span className="tabular-nums font-semibold">{total}</span>
              </>
            ) : (
              " "
            )}
          </div>
          <div className="flex items-center gap-2">
            <RippleButton
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 font-semibold disabled:opacity-60"
              disabled={loading || page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </RippleButton>
            <div className="text-xs text-gray-500 tabular-nums">Page {page + 1}</div>
            <RippleButton
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 font-semibold disabled:opacity-60"
              disabled={loading || (typeof total === "number" ? (page + 1) * pageSize >= total : rows.length < pageSize)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </RippleButton>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Organization</th>
                <th className="text-left font-semibold px-4 py-3">Item</th>
                <th className="text-left font-semibold px-4 py-3">Target user</th>
                <th className="text-left font-semibold px-4 py-3">Reason</th>
                <th className="text-left font-semibold px-4 py-3">When</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-gray-500" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-gray-500" colSpan={6}>
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
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <RippleButton
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold disabled:opacity-60"
                          disabled={busyId === r.id}
                          onClick={() => void showDetails(r)}
                        >
                          <Info size={14} />
                          Details
                        </RippleButton>
                        {r.status === "OPEN" ? (
                          <>
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
                          </>
                        ) : null}
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

