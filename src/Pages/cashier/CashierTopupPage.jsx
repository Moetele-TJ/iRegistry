import { useEffect, useMemo, useState } from "react";
import { Search, Receipt, Wallet, User, ChevronRight } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";

const PACKAGES = [
  { id: "BWP_30", label: "P30", credits: 10, amount: 30, currency: "BWP", usdRef: "2.22" },
  { id: "BWP_50", label: "P50", credits: 20, amount: 50, currency: "BWP", usdRef: "3.70" },
  { id: "BWP_100", label: "P100", credits: 50, amount: 100, currency: "BWP", usdRef: "7.40" },
];

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.id || "—";
}

export default function CashierTopupPage() {
  const { addToast } = useToast();
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [packageId, setPackageId] = useState(PACKAGES[0].id);
  const [receiptNo, setReceiptNo] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const selectedUser = useMemo(
    () => users.find((u) => String(u.id) === String(selectedUserId)) || null,
    [users, selectedUserId],
  );

  const filtered = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
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
  }, [users, q]);

  const pkg = PACKAGES.find((p) => p.id === packageId) || PACKAGES[0];

  async function submitTopup() {
    const rid = String(receiptNo || "").trim();
    if (!selectedUserId) {
      addToast({ type: "error", message: "Select a user first." });
      return;
    }
    if (!rid) {
      addToast({ type: "error", message: "Receipt number is required." });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await invokeWithAuth("cashier-topup", {
        body: {
          user_id: selectedUserId,
          package_id: packageId,
          receipt_no: rid,
          note: String(note || "").trim() || null,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Top up failed");
      }
      addToast({
        type: "success",
        message: `Top up successful: +${pkg.credits} credits. New balance: ${data.new_balance ?? "—"}.`,
      });
      if (typeof data.new_balance === "number") {
        setUsers((prev) =>
          (prev || []).map((u) =>
            String(u.id) === String(selectedUserId)
              ? { ...u, credit_balance: data.new_balance }
              : u,
          ),
        );
      }
      setReceiptNo("");
      setNote("");
    } catch (e) {
      addToast({ type: "error", message: e.message || "Top up failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-iregistrygreen" />
            Cashier top-up
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Record a cash/office payment and credit the user’s account.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <User size={18} className="text-gray-400" />
              Select user
            </div>
            <div className="text-xs text-gray-400">
              {loadingUsers ? "Loading…" : `${users.length} total`}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 mb-4">
            <Search size={18} className="text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full outline-none text-sm"
              placeholder="Search name, ID number, phone, email…"
            />
          </div>

          <div className="max-h-[420px] overflow-auto divide-y rounded-xl border border-gray-100">
            {filtered.map((u) => {
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
            {!loadingUsers && filtered.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">No users match your search.</div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Receipt size={18} className="text-gray-400" />
            Top-up details
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Selected user</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {selectedUser ? displayName(selectedUser) : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-1">{selectedUser ? `User ID: ${selectedUser.id}` : ""}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
              Current balance:
              <span className="tabular-nums">{Number(selectedUser?.credit_balance ?? 0)}</span>
              credits
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600">Package</label>
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
            >
              {PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} → {p.credits} credits (USD {p.usdRef})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Will credit <strong>{pkg.credits}</strong> credits for <strong>{pkg.label}</strong>.
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
            disabled={submitting}
            onClick={() => void submitTopup()}
          >
            {submitting ? "Processing…" : `Confirm top-up (+${pkg.credits} credits)`}
          </RippleButton>
        </section>
      </div>
    </div>
  );
}

