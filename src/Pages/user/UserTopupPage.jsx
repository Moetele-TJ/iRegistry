import { useEffect, useState } from "react";
import { Wallet, Loader2, Trash2, Save, CreditCard } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { roleIs } from "../../lib/roleUtils.js";
import PageSectionCard from "../shared/PageSectionCard.jsx";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

/** Shared pending top-up UI for user and police dashboards (same API + wallet rules). */
export function UserTopupContent() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(null);
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await invokeWithAuth("user-pending-topup", {
          body: { action: "get" },
        });
        if (cancelled) return;
        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to load");
        }
        setPending(data.pending || null);
        const pkgs = Array.isArray(data.packages) ? data.packages : [];
        setPackages(pkgs);
        const metaPid = data.pending?.metadata?.package_id;
        if (metaPid && pkgs.some((p) => p.id === metaPid)) {
          setPackageId(metaPid);
        } else if (pkgs[0]) {
          setPackageId(pkgs[0].id);
        }
        setNote(String(data.pending?.metadata?.user_note || ""));
      } catch (e) {
        if (!cancelled) {
          addToast({ type: "error", message: e?.message || "Failed to load" });
          setPending(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  async function savePending() {
    if (pending) return;
    if (!packageId) {
      addToast({ type: "error", message: "Choose a package." });
      return;
    }
    const ok = await confirm({
      title: "Submit pending top-up?",
      message:
        "This creates a request for staff to confirm when you pay at an office. Your card is not charged yet—credits are added only after confirmation.",
      confirmLabel: "Submit",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("user-pending-topup", {
        body: { action: "save", package_id: packageId, note },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not save");
      }
      setPending(data.pending || null);
      addToast({
        type: "success",
        message: data.pending ? "Pending top-up saved. Pay at an office or wait for online checkout (coming soon)." : "Saved.",
      });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  /** Placeholder until checkout is wired (pass `pending.id` / amount to payment session). */
  function startOnlinePayment() {
    addToast({
      type: "info",
      message: "Online payment isn't available yet. Complete this top-up in person with staff, or check back soon.",
    });
  }

  async function cancelPending() {
    const ok = await confirm({
      title: "Delete pending top-up?",
      message:
        "This removes your pending top-up request. You can submit a new one later. Nothing is refunded because no payment was taken yet.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("user-pending-topup", {
        body: { action: "cancel" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not cancel");
      }
      setPending(null);
      setNote("");
      addToast({ type: "success", message: "Pending top-up cancelled." });
      await refreshUser();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Could not cancel" });
    } finally {
      setSaving(false);
    }
  }

  if (!roleIs(user?.role, "user", "police")) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-10">
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-gray-700">
            Credit top-up requests are only available for registered user or police accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-3xl"
      title="Top up credits"
      subtitle={
        <>
          Create a <strong>pending</strong> top-up. You can have only one at a time. Complete it in person with
          cashier staff (or later via online payment when available). Email receipts are not required yet—staff will
          record the payment.
        </>
      }
      icon={<Wallet className="w-7 h-7 text-iregistrygreen shrink-0" />}
    >
        {loading ? (
          <div className="px-5 py-6 flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              This does <strong>not</strong> charge your card yet. Credits are added only after staff confirms your
              payment or when online checkout is enabled.
            </div>

            {pending ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="text-sm font-semibold text-emerald-900">Current pending request</div>
                  <div className="text-sm text-gray-800">
                    <span className="tabular-nums font-semibold">{pending.credits_granted}</span> credits •{" "}
                    <span className="tabular-nums">{Number(pending.amount ?? 0)}</span> {pending.currency || "BWP"}
                  </div>
                  <div className="text-xs text-gray-600">Created {fmtDate(pending.created_at)}</div>
                  <div className="text-xs text-gray-500">Status: {pending.status}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-end">
                  <RippleButton
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                    disabled={saving}
                    title="Pay online when checkout is available"
                    onClick={() => startOnlinePayment()}
                  >
                    <CreditCard size={18} />
                    Pay
                  </RippleButton>
                  <RippleButton
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 bg-white font-semibold disabled:opacity-60"
                    disabled={saving}
                    onClick={() => void cancelPending()}
                  >
                    <Trash2 size={18} />
                    Delete
                  </RippleButton>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">You have no pending top-up. Choose a package below and tap Submit.</p>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Package</label>
              <select
                value={packageId || ""}
                onChange={(e) => setPackageId(e.target.value)}
                disabled={!!pending}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm disabled:bg-gray-50 disabled:text-gray-600"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id.replace("BWP_", "P")} → {p.credits} credits ({p.amount} {p.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!!pending}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm min-h-[88px] disabled:bg-gray-50 disabled:text-gray-600"
                placeholder="e.g. I will pay at Central office Friday"
                maxLength={500}
              />
            </div>

            <div>
              <RippleButton
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60 w-full sm:w-auto"
                disabled={saving || !!pending || !packages.length}
                title={pending ? "Delete the pending request above to submit a new one." : undefined}
                onClick={() => void savePending()}
              >
                <Save size={18} />
                Submit
              </RippleButton>
            </div>
          </div>
        )}
    </PageSectionCard>
  );
}

export default function UserTopupPage() {
  return <UserTopupContent />;
}
