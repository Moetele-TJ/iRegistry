import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { messageForBillingFailure } from "../lib/billingUx.js";
import { useTaskPricing } from "./useTaskPricing.js";

/**
 * Maps invoke/ItemsContext errors (with optional `billing`) to a single user-facing string.
 */
export function useBillingErrorMessage() {
  const { user } = useAuth();
  const { getCost } = useTaskPricing();

  return useCallback(
    (err) => {
      const balance = Number(user?.credit_balance ?? 0);
      if (err?.billing?.required || err?.taskCode) {
        return messageForBillingFailure(err, { getCost, balance });
      }
      return err?.message || "Something went wrong.";
    },
    [getCost, user?.credit_balance]
  );
}
