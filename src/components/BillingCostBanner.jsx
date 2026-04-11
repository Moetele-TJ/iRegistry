import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTaskPricing } from "../hooks/useTaskPricing.js";
import BillingHelpLinks from "./BillingHelpLinks.jsx";

/**
 * Shows current balance and estimated credit cost(s) before a paid action.
 */
export default function BillingCostBanner({
  taskCodes = [],
  title = "Credits",
  subtitle,
  className = "",
}) {
  const { user } = useAuth();
  const balance = Number(user?.credit_balance ?? 0);
  const { getCost, getLabel, loading } = useTaskPricing();

  const codes = useMemo(
    () => (Array.isArray(taskCodes) ? taskCodes.filter(Boolean) : []),
    [taskCodes]
  );

  const total = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const c of codes) {
      const n = getCost(c);
      if (n != null) {
        sum += n;
        any = true;
      }
    }
    return any ? sum : null;
  }, [codes, getCost]);

  const shortfall =
    total != null && balance < total ? total - balance : null;

  return (
    <div
      className={`rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm ${className}`}
    >
      <div className="font-semibold text-emerald-900">{title}</div>
      {subtitle ? (
        <p className="text-emerald-800/90 mt-0.5 text-xs">{subtitle}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-emerald-900">
        <span>
          Balance:{" "}
          <span className="tabular-nums font-semibold">{balance}</span> credits
        </span>
        {loading && codes.length > 0 ? (
          <span className="text-xs text-emerald-700">Loading prices…</span>
        ) : null}
        {!loading && codes.length > 0 && total != null ? (
          <span>
            Estimated charge:{" "}
            <span className="tabular-nums font-semibold">{total}</span> credits
          </span>
        ) : null}
      </div>

      {codes.length > 0 && !loading ? (
        <ul className="mt-2 list-disc pl-5 text-emerald-900/90 space-y-0.5">
          {codes.map((c) => {
            const cost = getCost(c);
            const label = getLabel(c);
            return (
              <li key={c}>
                {label}
                {cost != null ? (
                  <span className="tabular-nums">
                    {" "}
                    — {cost} credit{cost === 1 ? "" : "s"}
                  </span>
                ) : null}
                <span className="text-emerald-700/80 text-xs ml-1">({c})</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {shortfall != null && shortfall > 0 ? (
        <p className="mt-2 text-amber-900 font-medium text-xs">
          You need {shortfall} more credit{shortfall === 1 ? "" : "s"} to cover this action.
        </p>
      ) : null}

      <div className="mt-2">
        <BillingHelpLinks />
      </div>
    </div>
  );
}
