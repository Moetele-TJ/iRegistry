import { useEffect, useMemo, useState } from "react";
import { Search, Receipt, Wallet, User, ChevronRight, Hourglass, Building2 } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function pkgLabel(p) {
  const cur = p?.currency || "BWP";
  const amt = Number(p?.amount ?? 0);
  if (cur === "BWP") return `P${amt}`;
  return `${cur} ${amt}`;
}

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.id || "—";
}

export default function CashierTopupPage() {
  const { addToast } = useToast();
  const { confirm } = useModal();
  const [targetType, setTargetType] = useState("user"); // user | organization
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [q, setQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [pendingPayment, setPendingPayment] = useState(null);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState("");
  const [pendingStaffNote, setPendingStaffNote] = useState("");
  const [completingPending, setCompletingPending] = useState(false);

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
        const { data, error } = await invokeWithAuth("list-orgs", { body: { q: "", limit: 200 } });
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

  useEffect(() => {
    let cancelled = false;
    async function loadPackages() {
      setLoadingPackages(true);
      try {
        const { data, error } = await invokeWithAuth("list-credit-packages");
        if (cancelled) return;
        if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load packages");
        const rows = Array.isArray(data.packages) ? data.packages : [];
        setPackages(rows);
        if (!packageId && rows[0]?.id) setPackageId(String(rows[0].id));
      } catch (e) {
        if (!cancelled) {
          addToast({ type: "error", message: e.message || "Failed to load packages" });
          setPackages([]);
        }
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    }
    void loadPackages();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast]);

  useEffect(() => {
    setPendingReceipt("");
    setPendingStaffNote("");
    if (targetType !== "user") {
      setPendingPayment(null);
      return;
    }
    if (!selectedUserId) {
      setPendingPayment(null);
      return;
    }
    let cancelled = false;
    async function loadPending() {
      setLoadingPending(true);
      try {
        const { data, error } = await invokeWithAuth("list-payments", {
          body: { user_id: selectedUserId, status: "PENDING", limit: 5 },
        });
        if (cancelled) return;
        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to load payments");
        }
        const rows = data.payments || [];
        const row =
          rows.find((p) => p?.metadata?.kind === "user_pending_topup") || rows[0] || null;
        setPendingPayment(row);
      } catch (e) {
        if (!cancelled) {
          addToast({ type: "error", message: e.message || "Failed to load pending top-up" });
          setPendingPayment(null);
        }
      } finally {
        if (!cancelled) setLoadingPending(false);
      }
    }
    void loadPending();
    return () => {
      cancelled = true;
    };
  }, [addToast, selectedUserId, targetType]);

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)) || null,
    [users, selectedUserId],
  );

  const selectedOrg = useMemo(
    () => orgs.find((o) => String(o.id) === String(selectedOrgId)) || null,
    [orgs, selectedOrgId],
  );

  const filtered = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (targetType === "organization") {
      const list = orgs || [];
      if (!query) return list.slice(0, 50);
      return list.filter((o) => {
        const hay = [
          o?.name || "",
          o?.registration_no || "",
          o?.contact_email || "",
          o?.phone || "",
          o?.id || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }
    if (!query) return users.slice(0, 50);
    return (users || []).filter((u) => {
      const hay = [
        displayName(u),
        u?.email || "",
        u?.phone || "",
        u?.id_number || "",
        u?.role || "",
        u?.status || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [users, orgs, q, targetType]);

  const pkg = (packages || []).find((p) => p.id === packageId) || packages[0] || null;

  async function submitTopup() {
    const rid = String(receiptNo || "").trim();
    if (targetType === "organization") {
      if (!selectedOrgId) {
        addToast({ type: "error", message: "Select an organization first." });
        return;
      }
    } else {
      if (!selectedUserId) {
        addToast({ type: "error", message: "Select a user first." });
        return;
      }
    }
    if (!rid) {
      addToast({ type: "error", message: "Receipt number is required." });
      return;
    }

    const who =
      targetType === "organization"
        ? (selectedOrg?.name || selectedOrgId)
        : (selectedUser ? displayName(selectedUser) : "this user");

    const ok = await confirm({
      title: "Confirm",
      message: `Credit ${who} with ${Number(pkg?.credits ?? 0)} credits for ${pkgLabel(pkg)}?`,
      confirmLabel: "Confirm top-up",
      cancelLabel: "Cancel",
      danger: false,
    }).catch(() => false);
    if (!ok) return;

    setSubmitting(true);
    try {
      const endpoint = targetType === "organization" ? "cashier-org-topup" : "cashier-topup";
      const payload =
        targetType === "organization"
          ? {
              org_id: selectedOrgId,
              package_id: packageId,
              receipt_no: rid,
              note: String(note || "").trim() || null,
            }
          : {
              user_id: selectedUserId,
              package_id: packageId,
              receipt_no: rid,
              note: String(note || "").trim() || null,
            };

      const { data, error } = await invokeWithAuth(endpoint, { body: payload });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Top up failed");
      }
      addToast({
        type: "success",
        message: `Top up successful: +${Number(pkg?.credits ?? 0)} credits. New balance: ${data.new_balance ?? "—"}.`,
      });
      if (typeof data.new_balance === "number") {
        if (targetType === "user") {
          setUsers((prev) =>
            (prev || []).map((u) =>
              String(u.id) === String(selectedUserId)
                ? { ...u, credit_balance: data.new_balance }
                : u,
            ),
          );
        } else if (targetType === "organization") {
          setOrgs((prev) =>
            (prev || []).map((o) =>
              String(o.id) === String(selectedOrgId)
                ? { ...o, credit_balance: data.new_balance }
                : o,
            ),
          );
        }
      }
      setReceiptNo("");
      setNote("");
    } catch (e) {
      addToast({ type: "error", message: e.message || "Top up failed" });
    } finally {
      setSubmitting(false);
    }
  }

  async function completePendingTopup() {
    if (!pendingPayment?.id) return;
    const rid = String(pendingReceipt || "").trim();
    if (!rid) {
      addToast({ type: "error", message: "Receipt number is required to complete the pending top-up." });
      return;
    }

    const ok = await confirm({
      title: "Complete pending top-up",
      message: `Confirm payment and credit ${pendingPayment.credits_granted ?? "—"} credits for ${selectedUser ? displayName(selectedUser) : "this user"}?`,
      confirmLabel: "Complete",
      cancelLabel: "Cancel",
      danger: false,
    }).catch(() => false);
    if (!ok) return;

    setCompletingPending(true);
    try {
      const { data, error } = await invokeWithAuth("staff-complete-pending-topup", {
        body: {
          payment_id: pendingPayment.id,
          receipt_no: rid,
          note: String(pendingStaffNote || "").trim() || null,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not complete");
      }
      addToast({
        type: "success",
        message: `Pending top-up completed. New balance: ${data.new_balance ?? "—"}.`,
      });
      setPendingPayment(null);
      setPendingReceipt("");
      setPendingStaffNote("");
      if (typeof data.new_balance === "number") {
        setUsers((prev) =>
          (prev || []).map((u) =>
            String(u.id) === String(selectedUserId) ? { ...u, credit_balance: data.new_balance } : u,
          ),
        );
      }
    } catch (e) {
      addToast({ type: "error", message: e.message || "Could not complete" });
    } finally {
      setCompletingPending(false);
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-6xl"
      title="Cashier top-up"
      subtitle="Record a cash/office payment and credit a user or organization wallet."
      icon={<Wallet className="w-6 h-6 text-iregistrygreen shrink-0" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
        <section className="lg:col-span-7 rounded-xl border border-gray-100 bg-gray-50/60 p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              {targetType === "organization" ? (
                <>
                  <Building2 size={18} className="text-gray-400" />
                  Select organization
                </>
              ) : (
                <>
                  <User size={18} className="text-gray-400" />
                  Select user
                </>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {targetType === "organization"
                ? (loadingOrgs ? "Loading…" : `${orgs.length} total`)
                : (loadingUsers ? "Loading…" : `${users.length} total`)}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <RippleButton
              type="button"
              className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                targetType === "user"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
              onClick={() => {
                setTargetType("user");
                setQ("");
              }}
            >
              User
            </RippleButton>
            <RippleButton
              type="button"
              className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                targetType === "organization"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-800 border-gray-200"
              }`}
              onClick={() => {
                setTargetType("organization");
                setQ("");
              }}
            >
              Organization
            </RippleButton>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 mb-4">
            <Search size={18} className="text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full outline-none text-sm"
              placeholder={targetType === "organization" ? "Search organization name, reg no…" : "Search name, ID number, phone, email…"}
            />
          </div>

          <div className="max-h-[420px] overflow-auto divide-y rounded-xl border border-gray-100">
            {targetType === "organization"
              ? filtered.map((o) => {
                  const active = String(o.id) === String(selectedOrgId);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOrgId(String(o.id))}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 ${
                        active ? "bg-emerald-50/60" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{String(o.name || "—")}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {o.registration_no ? `Reg: ${o.registration_no}` : null}
                          {o.registration_no && o.contact_email ? " • " : null}
                          {o.contact_email ? o.contact_email : null}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-300 shrink-0" />
                    </button>
                  );
                })
              : filtered.map((u) => {
                  const active = String(u.id) === String(selectedUserId);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(String(u.id))}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 ${
                        active ? "bg-emerald-50/60" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{displayName(u)}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.id_number ? `ID: ${u.id_number}` : null}
                          {u.id_number && u.phone ? " • " : null}
                          {u.phone ? `Phone: ${u.phone}` : null}
                          {(u.id_number || u.phone) && u.role ? " • " : null}
                          {u.role ? `Role: ${u.role}` : null}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-300 shrink-0" />
                    </button>
                  );
                })}
            {targetType === "organization" ? (
              !loadingOrgs && filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No organizations match your search.</div>
              ) : null
            ) : (
              !loadingUsers && filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No users match your search.</div>
              ) : null
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl border border-gray-100 bg-gray-50/60 p-5 space-y-5">
          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Receipt size={18} className="text-gray-400" />
            Top-up details
          </div>

          {targetType === "user" && selectedUserId && loadingPending ? (
            <div className="text-xs text-gray-500">Checking for pending user top-up…</div>
          ) : null}

          {targetType === "user" && selectedUser && pendingPayment ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                <Hourglass size={18} className="text-amber-700 shrink-0" />
                User’s pending top-up
              </div>
              <p className="text-xs text-amber-900/90">
                The customer submitted this request from their account. Enter the office receipt to confirm payment and
                credit their wallet.
              </p>
              <div className="text-sm text-gray-900 space-y-1">
                <div>
                  <span className="tabular-nums font-semibold">{Number(pendingPayment.credits_granted ?? 0)}</span>{" "}
                  credits ·{" "}
                  <span className="tabular-nums">{Number(pendingPayment.amount ?? 0)}</span>{" "}
                  {pendingPayment.currency || "BWP"}
                </div>
                {pendingPayment.metadata?.user_note ? (
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">User note:</span> {String(pendingPayment.metadata.user_note)}
                  </div>
                ) : null}
                <div className="text-xs text-gray-500">Payment ID: {pendingPayment.id}</div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Receipt number</label>
                <input
                  value={pendingReceipt}
                  onChange={(e) => setPendingReceipt(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  placeholder="Office receipt reference"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Staff note (optional)</label>
                <textarea
                  value={pendingStaffNote}
                  onChange={(e) => setPendingStaffNote(e.target.value)}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[72px] bg-white"
                  placeholder="Internal note…"
                />
              </div>
              <RippleButton
                type="button"
                className="w-full px-4 py-3 rounded-xl bg-amber-700 text-white font-semibold disabled:opacity-60"
                disabled={completingPending}
                onClick={() => void completePendingTopup()}
              >
                {completingPending ? "Completing…" : "Complete pending top-up"}
              </RippleButton>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {targetType === "organization" ? "Selected organization" : "Selected user"}
            </div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {targetType === "organization"
                ? (selectedOrg ? (selectedOrg.name || "—") : "—")
                : (selectedUser ? displayName(selectedUser) : "—")}
            </div>
            {(targetType === "user" && selectedUser) ||
            (targetType === "organization" && selectedOrg) ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                Current balance:
                <span className="tabular-nums">
                  {Number(
                    targetType === "organization"
                      ? (selectedOrg?.credit_balance ?? 0)
                      : (selectedUser?.credit_balance ?? 0),
                  )}
                </span>
                credits
              </div>
            ) : null}
          </div>

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">
            Instant top-up (walk-in)
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Use when the customer did not create a pending request—credits apply immediately after you confirm.
          </p>

          <div>
            <label className="text-xs text-gray-600">Package</label>
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              disabled={loadingPackages || packages.length === 0}
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {pkgLabel(p)} → {Number(p.credits ?? 0)} credits ({Number(p.amount ?? 0)} {p.currency || "BWP"})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Will credit <strong>{Number(pkg?.credits ?? 0)}</strong> credits for <strong>{pkgLabel(pkg)}</strong>.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-600">Receipt number</label>
            <input
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="e.g. RCPT-000123"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[92px]"
              placeholder="Any additional details for reconciliation…"
            />
          </div>

          <RippleButton
            type="button"
            className="w-full px-4 py-3 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            disabled={submitting || !pkg || !packageId}
            onClick={() => void submitTopup()}
          >
            {submitting ? "Processing…" : `Confirm top-up (+${Number(pkg?.credits ?? 0)} credits)`}
          </RippleButton>
        </section>
      </div>
    </PageSectionCard>
  );
}

