import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Building2, CheckSquare, Square, User, Users, RefreshCw, Undo2, X, Check, Wallet } from "lucide-react";
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

export default function OrganizationItemsPage() {
  const { orgId } = useParams();
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [error, setError] = useState(null);

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [myOpenReturnReqByItemId, setMyOpenReturnReqByItemId] = useState({});
  const [orgOpenRequests, setOrgOpenRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState("");

  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const isPrivileged = role === "ORG_ADMIN" || role === "ORG_MANAGER";

  async function loadWallet() {
    if (!orgId) return;
    setWalletLoading(true);
    try {
      const { data, error } = await invokeWithAuth("get-org-wallet", {
        body: { org_id: orgId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load wallet");
      setWalletBalance(typeof data.balance === "number" ? data.balance : 0);
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("list-org-items", {
        body: { org_id: orgId, limit: 200, includeDeleted },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load items");
      setItems(Array.isArray(data.items) ? data.items : []);
      setRole(data.role || null);
      setTotal(data.total ?? null);
    } catch (e) {
      setError(e.message || "Failed to load items");
      setItems([]);
      setRole(null);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadReturnRequests() {
    if (!orgId) return;
    setLoadingRequests(true);
    try {
      // Load my open requests always (members can request returns).
      const mine = await invokeWithAuth("list-org-item-return-requests", {
        body: { org_id: orgId, status: "OPEN", scope: "mine", limit: 200 },
      });
      if (mine?.error || !mine?.data?.success) {
        throw new Error(mine?.data?.message || mine?.error?.message || "Failed to load return requests");
      }
      const mineRows = Array.isArray(mine.data.requests) ? mine.data.requests : [];
      const by = {};
      for (const r of mineRows) {
        const iid = r?.item_id;
        if (iid) by[iid] = r;
      }
      setMyOpenReturnReqByItemId(by);

      if (isPrivileged) {
        const orgRes = await invokeWithAuth("list-org-item-return-requests", {
          body: { org_id: orgId, status: "OPEN", scope: "org", limit: 200 },
        });
        if (orgRes?.error || !orgRes?.data?.success) {
          throw new Error(orgRes?.data?.message || orgRes?.error?.message || "Failed to load org return requests");
        }
        setOrgOpenRequests(Array.isArray(orgRes.data.requests) ? orgRes.data.requests : []);
      } else {
        setOrgOpenRequests([]);
      }
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load return requests" });
      setMyOpenReturnReqByItemId({});
      setOrgOpenRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function loadMembers() {
    if (!isPrivileged) return;
    setLoadingMembers(true);
    try {
      const { data, error } = await invokeWithAuth("list-org-members", {
        body: { org_id: orgId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load members");
      const rows = Array.isArray(data.members) ? data.members : [];
      setMembers(rows);
      const first = rows.find((m) => m?.status === "ACTIVE")?.user_id;
      if (!assigneeId && first) setAssigneeId(String(first));
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load members" });
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    void loadItems();
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, includeDeleted]);

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isPrivileged]);

  useEffect(() => {
    void loadReturnRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isPrivileged]);

  const selectedCount = selected.size;

  const activeMembers = useMemo(
    () => (members || []).filter((m) => m?.status === "ACTIVE" && m?.user_id),
    [members],
  );

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === (items || []).length) return new Set();
      return new Set((items || []).map((i) => i.id));
    });
  }

  async function bulkAssign({ unassign = false } = {}) {
    if (!isPrivileged) return;
    if (selectedCount === 0) {
      addToast({ type: "error", message: "Select at least one item." });
      return;
    }
    if (!unassign && !assigneeId) {
      addToast({ type: "error", message: "Select a member first." });
      return;
    }
    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("bulk-assign-org-items", {
        body: {
          org_id: orgId,
          item_ids: Array.from(selected),
          assign_to_user_id: unassign ? null : assigneeId,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: unassign ? "Items unassigned." : "Items assigned." });
      setSelected(new Set());
      await loadItems();
      await loadReturnRequests();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function requestReturn(itemId) {
    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("create-org-item-return-request", {
        body: { org_id: orgId, item_id: itemId, note: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Return request submitted." });
      await loadReturnRequests();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function reviewReturn({ requestId, action }) {
    setReviewBusyId(requestId);
    try {
      const { data, error } = await invokeWithAuth("review-org-item-return-request", {
        body: { org_id: orgId, request_id: requestId, action, note: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: action === "approve" ? "Return approved." : "Return rejected." });
      await loadItems();
      await loadReturnRequests();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setReviewBusyId("");
    }
  }

  const isOrgAdmin = role === "ORG_ADMIN";

  async function deleteItem(itemId, itemName) {
    const ok = await confirm({
      title: "Delete item?",
      message: `This will delete “${itemName || "this item"}” from the organization list. You can restore it later.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-delete-item", {
        body: { org_id: orgId, item_id: itemId, reason: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Item deleted." });
      await loadItems();
      await loadWallet();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  async function restoreItem(itemId, itemName) {
    const ok = await confirm({
      title: "Restore item?",
      message: `Restoring “${itemName || "this item"}” will charge the organization wallet (RESTORE_ITEM).`,
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setBulkBusy(true);
    try {
      const { data, error } = await invokeWithAuth("org-restore-item", {
        body: { org_id: orgId, item_id: itemId },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Item restored." });
      await loadItems();
      await loadWallet();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed" });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization items"
      subtitle={isPrivileged ? "Manage organization-owned items and assignments." : "Your assigned organization items."}
      icon={<Building2 className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/organizations/${orgId}/wallet`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50"
          >
            <Wallet size={16} />
            Organization wallet
          </Link>
          <Link
            to={`/organizations/${orgId}/transactions`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            Transactions
          </Link>
          {isPrivileged ? (
            <Link
              to={`/organizations/${orgId}/members`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <Users size={16} />
              Members
            </Link>
          ) : null}
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => {
              void loadItems();
              void loadWallet();
            }}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-xl bg-white border border-emerald-100 p-2 text-emerald-800 shrink-0">
              <Wallet size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">Organization wallet</div>
              <div className="text-lg font-bold text-emerald-950 tabular-nums">
                {walletLoading ? "…" : walletBalance === null ? "—" : walletBalance.toLocaleString()}{" "}
                <span className="text-sm font-semibold text-emerald-900/70">credits</span>
              </div>
            </div>
          </div>
          <Link
            to={`/organizations/${orgId}/wallet`}
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50 shrink-0"
          >
            View details
          </Link>
        </div>

        {isPrivileged ? (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <input
              id="includeDeleted"
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            <label htmlFor="includeDeleted">Show deleted items</label>
          </div>
        ) : null}

        {isPrivileged ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Bulk assignment</div>
              <div className="text-sm text-gray-700">
                Selected: <span className="font-semibold tabular-nums">{selectedCount}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div className="min-w-[240px]">
                <label className="text-xs text-gray-600">Assign to</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={loadingMembers || activeMembers.length === 0}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                >
                  {activeMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {displayName(m.user)} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <RippleButton
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                disabled={bulkBusy || selectedCount === 0 || (!assigneeId && activeMembers.length > 0)}
                onClick={() => void bulkAssign({ unassign: false })}
              >
                <Users size={18} />
                Assign
              </RippleButton>
              <RippleButton
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold disabled:opacity-60"
                disabled={bulkBusy || selectedCount === 0}
                onClick={() => void bulkAssign({ unassign: true })}
              >
                <User size={18} />
                Unassign
              </RippleButton>
            </div>
          </div>
        ) : null}

        {isPrivileged ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold text-gray-800">Return requests</div>
              {loadingRequests ? <div className="text-xs text-gray-400">Loading…</div> : null}
            </div>
            {orgOpenRequests.length === 0 ? (
              <div className="text-sm text-gray-500">No open return requests.</div>
            ) : (
              <div className="space-y-2">
                {orgOpenRequests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {r?.item?.name || r.item_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        Requested: {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RippleButton
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                        disabled={reviewBusyId === r.id}
                        onClick={() => void reviewReturn({ requestId: r.id, action: "approve" })}
                      >
                        <Check size={16} />
                        Approve
                      </RippleButton>
                      <RippleButton
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-sm font-semibold disabled:opacity-60"
                        disabled={reviewBusyId === r.id}
                        onClick={() => void reviewReturn({ requestId: r.id, action: "reject" })}
                      >
                        <X size={16} />
                        Reject
                      </RippleButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {isPrivileged ? (
                  <th className="text-left font-semibold px-4 py-3 w-12">
                    <button type="button" onClick={toggleAll} className="p-1 rounded hover:bg-gray-100">
                      {selectedCount === (items || []).length && (items || []).length > 0 ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                ) : null}
                <th className="text-left font-semibold px-4 py-3">Item</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                {isPrivileged ? <th className="text-left font-semibold px-4 py-3">Assigned</th> : null}
                {!isPrivileged ? <th className="text-right font-semibold px-4 py-3">Action</th> : null}
                {isPrivileged ? <th className="text-right font-semibold px-4 py-3">Admin</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={isPrivileged ? 4 : 4}>
                    Loading…
                  </td>
                </tr>
              ) : (items || []).length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={isPrivileged ? 4 : 4}>
                    No items found.
                  </td>
                </tr>
              ) : (
                items.map((i) => {
                  const stolen = !!i.reportedstolenat;
                  const legacy = !!i.legacyat;
                  const status = legacy ? "Legacy" : stolen ? "Stolen" : "Active";
                  const checked = selected.has(i.id);
                  const myReq = myOpenReturnReqByItemId?.[i.id] || null;
                  return (
                    <tr key={i.id} className="hover:bg-gray-50">
                      {isPrivileged ? (
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => toggle(i.id)} className="p-1 rounded hover:bg-gray-100">
                            {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{i.name || "—"}</div>
                        <div className="text-xs text-gray-500">{i.category || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${
                            status === "Stolen"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : status === "Legacy"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-100"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      {isPrivileged ? (
                        <td className="px-4 py-3 text-gray-700">
                          {i.assigned_user_id ? (
                            <span className="text-xs font-mono">{String(i.assigned_user_id).slice(0, 8)}…</span>
                          ) : (
                            <span className="text-xs text-gray-500">Unassigned</span>
                          )}
                        </td>
                      ) : null}
                      {isPrivileged ? (
                        <td className="px-4 py-3 text-right">
                          {isOrgAdmin ? (
                            i.deletedat ? (
                              <RippleButton
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                                disabled={bulkBusy}
                                onClick={() => void restoreItem(i.id, i.name)}
                              >
                                Restore
                              </RippleButton>
                            ) : (
                              <RippleButton
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-xs font-semibold hover:bg-red-50 disabled:opacity-60"
                                disabled={bulkBusy}
                                onClick={() => void deleteItem(i.id, i.name)}
                              >
                                Delete
                              </RippleButton>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      ) : null}
                      {!isPrivileged ? (
                        <td className="px-4 py-3 text-right">
                          {myReq ? (
                            <span className="text-xs text-gray-500 inline-flex items-center gap-2 justify-end">
                              <Undo2 size={14} className="text-gray-400" />
                              Return requested
                            </span>
                          ) : (
                            <RippleButton
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60"
                              disabled={bulkBusy}
                              onClick={() => void requestReturn(i.id)}
                            >
                              <Undo2 size={14} />
                              Request return
                            </RippleButton>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total != null ? (
          <div className="text-xs text-gray-400">
            Total: <span className="tabular-nums">{total}</span>
          </div>
        ) : null}
      </div>
    </PageSectionCard>
  );
}

