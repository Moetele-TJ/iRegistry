import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { USER_PRICING_PATH, USER_TRANSACTIONS_PATH } from "../lib/billingUx.js";

/**
 * Dashboard row: balance, quick links, last top-up line (if any).
 */
export default function CreditsSummaryStrip() {
  const { user } = useAuth();
  const balance = Number(user?.credit_balance ?? 0);
  const [lastTopUp, setLastTopUp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await invokeWithAuth("list-my-payments", {
          // Fetch extra rows: pending/failed entries are ignored below.
          body: { limit: 40, offset: 0 },
        });
        if (cancelled || error || !data?.success) return;
        const rows = data.payments || [];
        const topUps = rows.filter((p) => {
          if (Number(p.credits_granted ?? 0) <= 0) return false;
          // Only credits that actually landed in this account (not pending requests,
          // not reversed). Pending rows still carry package credits_granted, which
          // wrongly looked like a completed top-up next to balance 0.
          if (p.status !== "CONFIRMED") return false;
          if (p.reversed_at) return false;
          return true;
        });
        const last = topUps[0];
        if (last) setLastTopUp(last);
        else setLastTopUp(null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Credits</div>
        <div className="text-2xl font-bold text-emerald-700 tabular-nums">{balance}</div>
        {lastTopUp?.created_at ? (
          <p className="text-xs text-gray-500 mt-1">
            Last top-up:{" "}
            {new Date(lastTopUp.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {Number(lastTopUp.credits_granted ?? 0) > 0 ? (
              <span className="text-gray-600">
                {" "}
                (+{Number(lastTopUp.credits_granted)} credits)
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">Top up via a cashier to add credits.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={USER_PRICING_PATH}
          className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 transition"
        >
          Credit pricing
        </Link>
        <Link
          to={USER_TRANSACTIONS_PATH}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 transition"
        >
          Transactions
        </Link>
      </div>
    </div>
  );
}
