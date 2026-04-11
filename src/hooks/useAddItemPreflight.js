import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { useTaskPricing } from "./useTaskPricing.js";
import {
  isBalanceBelowAddItemMinimum,
  getAddItemChargeIfApplicable,
  formatInsufficientCreditsMessage,
} from "../lib/billingUx.js";

/**
 * Navigate to /items/add after optional low-balance confirm (paid registrations).
 */
export function useAddItemPreflight() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items = [] } = useItems();
  const { confirm } = useModal();
  const { getCost, loading: tasksLoading } = useTaskPricing();

  const privilegedActor = useMemo(
    () => ["admin", "cashier"].includes(String(user?.role || "").toLowerCase()),
    [user?.role]
  );

  const createdByCount = useMemo(() => {
    const uid = user?.id;
    if (!uid) return 0;
    return items.filter((it) => it.createdBy === uid).length;
  }, [items, user?.id]);

  const goToAddItem = useCallback(async () => {
    if (tasksLoading) return;
    const balance = Number(user?.credit_balance ?? 0);
    const ctx = { createdByCount, privileged: privilegedActor, getCost };
    if (isBalanceBelowAddItemMinimum(balance, ctx)) {
      const charge = getAddItemChargeIfApplicable(ctx);
      const msg = formatInsufficientCreditsMessage(
        "Your balance is below the credits required to register another item (after your first two free lifetime registrations).",
        {
          creditsCost: charge ?? undefined,
          balance,
          taskCode: "ADD_ITEM",
        }
      );
      const proceed = await confirm({
        title: "Credit balance is low",
        message: msg,
        confirmLabel: "Continue to registration",
        cancelLabel: "Stay here",
        variant: "warning",
      }).catch(() => false);
      if (!proceed) return;
    }
    navigate("/items/add");
  }, [
    tasksLoading,
    user?.credit_balance,
    createdByCount,
    privilegedActor,
    getCost,
    confirm,
    navigate,
  ]);

  return { goToAddItem, tasksLoading };
}
