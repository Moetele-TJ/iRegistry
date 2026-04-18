import { useEffect, useMemo, useState } from "react";
import { Search, RotateCcw, ReceiptText, Filter, Building2, User } from "lucide-react";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import RippleButton from "../../components/RippleButton.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { formatMoneyAmount } from "../../lib/formatBWP.js";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.phone || u?.id || "—";
}

function orgLabel(o) {
  return String(o?.name || "").trim() || o?.registration_no || "—";
}

/** @param {object} p — payment row from list-payments */
function accountLabel(p) {
  if (p?.wallet === "org") {
    const n = p?.organization?.name;
    return n ? String(n).trim() : "Organization";
  }
  const who = p?.users || null;
  return who ? displayName(who) : p?.user_id || "—";
}

function paymentRowKey(p) {
  return `${p?.wallet || "user"}:${p?.id}`;
}

export default function AdminTransactionsPage({ canReverse = true, showSidebar = true } = {}) {
  const { addToast } = useToast();

  const REVERSAL_REASONS = useMemo(
    () => [
      "Duplicate payment",
      "Wrong user credited",
      "Wrong package/amount",
      "Customer refunded (cash)",
      "Chargeback / disputed payment",
      "Fraud / suspicious activity",
      "Data entry mistake",
      "Other",
    ],
    [],
  );

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [orgQuery, setOrgQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [scope, setScope] = useState("both");

  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [reversingId, setReversingId] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [reverseReasonPreset, setReverseReasonPreset] = useState("");
  const [reverseModal, setReverseModal] = useState({ isOpen: false, payment: null });

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

  useEffect(() => {
    let cancelled = false;
    async function loadOrgs() {
      setLoadingOrgs(true);
      try {
        const { data, error } = await invokeWithAuth("list-orgs", { body: { q: "", limit: 500 } });
        if (cancelled) return;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load organizations");
        setOrgs(data.organizations || []);
      } catch (e) {
        addToast({ type: "error", message: e.message || "Failed to load organizations" });
        setOrgs([]);
      } finally {
        if (!cancelled) setLoadingOrgs(false);
      }
    }
    void loadOrgs();
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

  const filteredOrgs = useMemo(() => {
    const q = String(orgQuery || "").trim().toLowerCase();
    if (!q) return (orgs || []).slice(0, 80);
    return (orgs || []).filter((o) => {
      const hay = [orgLabel(o), o?.registration_no || "", o?.slug || "", o?.id || ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [orgs, orgQuery]);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)) || null,
    [users, selectedUserId],
  );

  const selectedOrg = useMemo(
    () => orgs.find((o) => String(o.id) === String(selectedOrgId)) || null,
    [orgs, selectedOrgId],
  );

  async function loadPayments() {
    setLoadingPayments(true);
    try {
      const body = {
        limit: 100,
        offset: 0,
        scope,
      };
      if (selectedUserId) body.user_id = selectedUserId;
      if (selectedOrgId) body.org_id = selectedOrgId;
      const { data, error } = await invokeWithAuth("list-payments", { body });
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
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, selectedOrgId, scope]);

  function openReverseModal(payment) {
    if (!canReverse) return;
    setReverseReasonPreset("");
    setReverseModal({ isOpen: true, payment });
  }

  function closeReverseModal() {
    if (reversingId) return;
    setReverseModal({ isOpen: false, payment: null });
  }

  async function reversePayment(payment) {
    if (!canReverse || !payment?.id) return;
    const reason = String(reverseReason || "").trim();
    if (!reason) {
      return;
    }

    const isOrg = payment.wallet === "org";
    const key = paymentRowKey(payment);
    setReversingId(key);
    try {
      const { data, error } = await invokeWithAuth(isOrg ? "reverse-org-payment" : "reverse-payment", {
        body: isOrg ? { org_payment_id: payment.id, reason } : { payment_id: payment.id, reason },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Could not reverse payment");
      addToast({ type: "success", message: "Transaction reversed successfully." });
      setReverseReason("");
      await loadPayments();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Could not reverse payment" });
    } finally {
      setReversingId("");
    }
  }

  const filterPanel = (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Source</div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-xs font-semibold shadow-sm flex-wrap">
          {[
            { id: "both", label: "All" },
            { id: "user", label: "Users" },
            { id: "org", label: "Organizations" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                scope === opt.id ? "bg-iregistrygreen text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {scope === "both"
            ? "User-wallet and organization top-ups."
            : scope === "user"
              ? "Personal wallet payments only."
              : "Organization wallet payments only."}
        </p>
      </div>

      {(scope === "both" || scope === "user") && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            Filter by user
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
          <div className="max-h-[280px] overflow-auto divide-y rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => setSelectedUserId("")}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedUserId ? "" : "bg-emerald-50/60"}`}
            >
              <div className="font-medium text-gray-900">All users</div>
              <div className="text-xs text-gray-500">Include every user-wallet transaction (within source)</div>
            </button>
            {loadingUsers && users.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading users…</div>
            ) : null}
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
        </div>
      )}

      {(scope === "both" || scope === "org") && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Building2 size={18} className="text-gray-400" />
            Filter by organization
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input
              value={orgQuery}
              onChange={(e) => setOrgQuery(e.target.value)}
              className="w-full outline-none text-sm"
              placeholder="Search organization…"
            />
          </div>
          <div className="max-h-[280px] overflow-auto divide-y rounded-xl border border-gray-100">
            <button
              type="button"
              onClick={() => setSelectedOrgId("")}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedOrgId ? "" : "bg-sky-50/60"}`}
            >
              <div className="font-medium text-gray-900">All organizations</div>
              <div className="text-xs text-gray-500">Include every org top-up (within source)</div>
            </button>
            {loadingOrgs ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading organizations…</div>
            ) : (
              filteredOrgs.map((o) => {
                const active = String(o.id) === String(selectedOrgId);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrgId(String(o.id))}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${active ? "bg-sky-50/60" : ""}`}
                  >
                    <div className="font-medium text-gray-900 truncate">{orgLabel(o)}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {o.registration_no ? `Reg: ${o.registration_no}` : "Organization wallet"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  const paymentsHeader = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-sm font-semibold text-gray-800">Payments</div>
        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
          <div>
            {scope === "user" && selectedUser
              ? `User wallet: ${displayName(selectedUser)}`
              : null}
            {scope === "org" && selectedOrg ? `Organization: ${orgLabel(selectedOrg)}` : null}
            {scope === "both" && (selectedUser || selectedOrg) ? (
              <>
                {selectedUser ? <span>User: {displayName(selectedUser)}. </span> : null}
                {selectedOrg ? <span>Org: {orgLabel(selectedOrg)}.</span> : null}
              </>
            ) : null}
            {scope === "both" && !selectedUser && !selectedOrg ? "Latest user and organization payments." : null}
            {scope === "user" && !selectedUser ? "All user-wallet payments." : null}
            {scope === "org" && !selectedOrg ? "All organization payments." : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <RippleButton
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          onClick={() => void loadPayments()}
          disabled={loadingPayments}
        >
          Refresh
        </RippleButton>
      </div>
    </div>
  );

  return (
    <>
      <ConfirmModal
        isOpen={reverseModal.isOpen}
        onClose={closeReverseModal}
        onConfirm={async () => {
          const p = reverseModal?.payment;
          if (!p?.id) return;
          await reversePayment(p);
          closeReverseModal();
        }}
        title="Confirm"
        message={
          reverseModal?.payment?.wallet === "org"
            ? "This will subtract credits from the organization wallet if the full credited amount is still available (nothing spent from it yet)."
            : "This will subtract credits from the user if they still have enough balance."
        }
        confirmLabel={reversingId ? "Reversing…" : "Reverse"}
        cancelLabel="Cancel"
        danger
        confirmDisabled={reversingId || !String(reverseReason || "").trim()}
      >
        <div className="space-y-2">
          <div className="text-xs text-gray-500">Reason is required.</div>
          <div>
            <label className="text-xs text-gray-600">Quick reason</label>
            <select
              value={reverseReasonPreset}
              onChange={(e) => {
                const v = e.target.value;
                setReverseReasonPreset(v);
                if (v && v !== "Other") setReverseReason(v);
                if (v === "Other") setReverseReason("");
              }}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Select…</option>
              {REVERSAL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm min-h-[90px]"
            placeholder="Reversal reason…"
          />
        </div>
      </ConfirmModal>
      <PageSectionCard
        maxWidthClass="max-w-7xl"
        title="Transactions"
        subtitle="User-wallet and organization top-ups. Admins can reverse confirmed cashier top-ups when the credited balance is still intact."
        icon={<ReceiptText className="w-6 h-6 text-iregistrygreen shrink-0" />}
      >
        <div
          className={
            showSidebar ? "grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6" : "space-y-4 p-4 sm:p-6"
          }
        >
          <section
            className={
              showSidebar
                ? "lg:col-span-4 rounded-xl border border-gray-100 bg-gray-50/60 p-5 space-y-4"
                : "rounded-xl border border-gray-100 bg-gray-50/60 p-5"
            }
          >
            {filterPanel}
          </section>

          <section
            className={
              showSidebar ? "lg:col-span-8 rounded-xl border border-gray-100 bg-gray-50/60 p-5 space-y-4" : "space-y-4"
            }
          >
            {paymentsHeader}

            {loadingPayments ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : payments.length === 0 ? (
              <div className="text-sm text-gray-500">No transactions found.</div>
            ) : (
              <>
                <div className="md:hidden space-y-3 -mx-1">
                  {payments.map((p) => {
                    const rowKey = `${p.wallet || "user"}-${p.id}`;
                    const revKey = paymentRowKey(p);
                    const reversible = p.status === "CONFIRMED" && !p.reversed_at;
                    const statusLabel = p.reversed_at ? "REVERSED" : (p.status || "—");
                    const statusClass = p.reversed_at
                      ? "bg-gray-50 text-gray-700 border border-gray-100"
                      : p.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                        : p.status === "FAILED"
                          ? "bg-red-50 text-red-700 border border-red-100"
                          : "bg-gray-50 text-gray-700 border border-gray-100";

                    return (
                      <div key={rowKey} className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              {p.wallet === "org" ? (
                                <Building2 className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden />
                              ) : (
                                <User className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                              )}
                              <div className="text-sm font-semibold text-gray-900 truncate">{accountLabel(p)}</div>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                            </div>
                            {p.receipt_no ? (
                              <div className="text-xs text-gray-500 mt-0.5 truncate">Receipt: {p.receipt_no}</div>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold text-gray-900 tabular-nums">
                              {formatMoneyAmount(p.currency, p.amount)}
                            </div>
                            <div className="text-xs text-gray-500 tabular-nums">{p.credits_granted ?? 0} credits</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                              {statusLabel}
                            </span>
                            <span className="text-xs text-gray-500">{p.channel || "—"}</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          {canReverse ? (
                            <RippleButton
                              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-600 bg-red-600 text-white text-sm font-semibold shadow-md hover:bg-red-700 hover:border-red-700 active:shadow-sm active:translate-y-[1px] disabled:opacity-60"
                              disabled={!reversible || reversingId === revKey}
                              onClick={() => openReverseModal(p)}
                            >
                              <RotateCcw size={16} />
                              {reversingId === revKey ? "Reversing…" : "Reverse payment"}
                            </RippleButton>
                          ) : (
                            <RippleButton
                              className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm hover:bg-gray-50 disabled:opacity-60"
                              disabled
                            >
                              Read only
                            </RippleButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-auto rounded-xl border border-gray-100">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left font-semibold px-4 py-3">Date</th>
                        <th className="text-left font-semibold px-4 py-3">Account</th>
                        <th className="text-left font-semibold px-4 py-3">Channel</th>
                        <th className="text-left font-semibold px-4 py-3">Amount</th>
                        <th className="text-left font-semibold px-4 py-3">Credits</th>
                        <th className="text-left font-semibold px-4 py-3">Status</th>
                        <th className="text-right font-semibold px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payments.map((p) => {
                        const rowKey = `${p.wallet || "user"}-${p.id}`;
                        const revKey = paymentRowKey(p);
                        const reversible = p.status === "CONFIRMED" && !p.reversed_at;
                        return (
                          <tr key={rowKey} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-800">
                              <div className="flex items-center gap-2 min-w-0">
                                {p.wallet === "org" ? (
                                  <Building2 className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden />
                                ) : (
                                  <User className="w-4 h-4 shrink-0 text-gray-500" aria-hidden />
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{accountLabel(p)}</div>
                                  {p.receipt_no ? <div className="text-xs text-gray-500">Receipt: {p.receipt_no}</div> : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{p.channel}</td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatMoneyAmount(p.currency, p.amount)}</td>
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
                            <td className="px-4 py-3 text-right">
                              {canReverse ? (
                                <RippleButton
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-sm disabled:opacity-50"
                                  disabled={!reversible || reversingId === revKey}
                                  onClick={() => openReverseModal(p)}
                                >
                                  <RotateCcw size={16} />
                                  {reversingId === revKey ? "Reversing…" : "Reverse"}
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
              </>
            )}
          </section>
        </div>
      </PageSectionCard>
    </>
  );
}
