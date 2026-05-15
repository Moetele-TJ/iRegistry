import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

function formatPromoEndLabel(iso) {
  if (!iso) return "30 June";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "30 June";
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "30 June";
  }
}

export default function PromoModeBanner({ className = "" } = {}) {
  const { user } = useAuth();

  const endLabel = useMemo(() => {
    if (!user?.promo_active) return null;
    const ends = user?.promo?.effective_ends_at || user?.promo?.proposed_ends_at || null;
    return formatPromoEndLabel(ends);
  }, [user?.promo_active, user?.promo?.effective_ends_at, user?.promo?.proposed_ends_at]);

  if (!endLabel) return null;

  return (
    <div
      className={[
        "rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <div className="font-semibold">Free registration until {endLabel}</div>
      <div className="text-emerald-900/90 mt-0.5">
        Register as many items as you like — no credits or cashier top-up required.
      </div>
    </div>
  );
}
