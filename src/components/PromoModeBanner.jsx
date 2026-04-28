import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

function formatEndLabel(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch {
    return null;
  }
}

export default function PromoModeBanner({ className = "" } = {}) {
  const { user } = useAuth();

  const message = useMemo(() => {
    if (!user?.promo_active) return null;
    const ends = user?.promo?.effective_ends_at || user?.promo?.proposed_ends_at || null;
    const endsLabel = formatEndLabel(ends);
    if (endsLabel) return `Promotional mode until ${endsLabel}.`;
    return "Promotional mode is active.";
  }, [user?.promo_active, user?.promo?.effective_ends_at, user?.promo?.proposed_ends_at]);

  if (!message) return null;

  return (
    <div
      className={[
        "rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <div className="font-semibold">Promotional mode</div>
      <div className="text-amber-900/90">{message}</div>
    </div>
  );
}

