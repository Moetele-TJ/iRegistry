import { Package, ShieldCheck, Sparkles } from "lucide-react";
import RippleButton from "./RippleButton.jsx";
import { useAddItemPreflight } from "../hooks/useAddItemPreflight.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/**
 * Shown after first login (or ?welcome=1) when the user has no registered items.
 */
export default function FirstItemWelcomeModal({ open, onDismiss }) {
  const { user } = useAuth();
  const { goToAddItem, tasksLoading } = useAddItemPreflight();
  const promoActive = Boolean(user?.promo_active);

  if (!open) return null;

  async function handleRegister() {
    onDismiss?.();
    await goToAddItem();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-item-welcome-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-emerald-100 overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-50 to-white px-6 pt-8 pb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-iregistrygreen text-white shadow-lg">
            <Package size={28} strokeWidth={2.2} />
          </div>
          <h2
            id="first-item-welcome-title"
            className="text-xl font-bold text-gray-900"
          >
            Your account is ready
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            An iRegistry account alone doesn&apos;t protect your belongings yet.
            Register a phone, laptop, Television, or anything with a serial number
            to get a verifiable record on Botswana&apos;s digital asset registry.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <ul className="space-y-2.5 text-sm text-gray-700">
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="shrink-0 mt-0.5 text-emerald-600" size={18} />
              <span>Prove ownership if your item is lost or disputed</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Sparkles className="shrink-0 mt-0.5 text-emerald-600" size={18} />
              <span>
                {promoActive
                  ? "Registration is free right now — takes about 2 minutes"
                  : "Your first two registrations are free — takes about 2 minutes"}
              </span>
            </li>
          </ul>

          <RippleButton
            className="w-full py-3 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            onClick={() => void handleRegister()}
            disabled={tasksLoading}
          >
            {promoActive ? "Register my first item — free" : "Register my first item"}
          </RippleButton>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}
