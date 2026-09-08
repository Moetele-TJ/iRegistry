import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useTaskPricing } from "./useTaskPricing.js";
import {
  formatInsufficientCreditsMessage,
  isPrivilegedRole,
  USER_TOPUP_PATH,
  POLICE_TOPUP_PATH,
} from "../lib/billingUx.js";
import { roleIs } from "../lib/roleUtils.js";

const PACK_TASK = "LIVESTOCK_REGISTER_PACK";
const FREE_LIFETIME = 2;

function topupPathForRole(role) {
  if (roleIs(role, "police")) return POLICE_TOPUP_PATH;
  return USER_TOPUP_PATH;
}

/**
 * Navigate to livestock register after handling free-tier → pack gate.
 * First 2 animals are silent; 3rd+ requires a registration pack (credits).
 */
export function useRegisterAnimalPreflight() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm } = useModal();
  const { addToast } = useToast();
  const { getCost, loading: tasksLoading } = useTaskPricing();

  const goToRegisterAnimal = useCallback(
    async ({ path, ownerId, ownerLabel } = {}) => {
      if (!path) return;
      if (tasksLoading) return;

      const scrollTop = () => {
        window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      };

      const navState =
        ownerId && String(ownerId).trim()
          ? {
              registerForOwnerId: String(ownerId).trim(),
              registerForOwnerLabel: ownerLabel || null,
            }
          : undefined;

      const billingOwnerId =
        ownerId && String(ownerId).trim()
          ? String(ownerId).trim()
          : user?.id != null
            ? String(user.id)
            : "";

      const registeringForOther =
        isPrivilegedRole(user?.role) &&
        billingOwnerId &&
        billingOwnerId !== String(user?.id);

      // Staff registering for a customer: don't block on the staff wallet — go register.
      if (registeringForOther) {
        navigate(path, { state: navState });
        scrollTop();
        return;
      }

      let packStatus = null;
      try {
        const { data, error } = await invokeWithAuth("livestock-api", {
          body: {
            operation: "livestock-get-pack-status",
            owner_id: billingOwnerId || undefined,
          },
        });
        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Could not check registration status");
        }
        packStatus = data;
      } catch (e) {
        addToast({ type: "error", message: e?.message || "Could not check registration status" });
        return;
      }

      if (packStatus.can_register) {
        navigate(path, { state: navState });
        scrollTop();
        return;
      }

      const packCost = getCost(PACK_TASK);
      const minCredits =
        typeof packCost === "number" && Number.isFinite(packCost) ? packCost : 5;
      const balance = Number(user?.credit_balance ?? 0);
      const life = Number(packStatus?.pack?.lifetime_registered ?? 0);

      const baseMsg =
        life >= FREE_LIFETIME
          ? `Your first ${FREE_LIFETIME} animal registrations are free. To register another animal you need a registration pack (10 animals), which costs at least ${minCredits} credits.`
          : `A registration pack (10 animals) costs at least ${minCredits} credits.`;

      const msg = formatInsufficientCreditsMessage(baseMsg, {
        taskCode: PACK_TASK,
        creditsCost: minCredits,
        balance,
        balanceLabel: "Your balance",
      });

      if (balance < minCredits) {
        const goTopup = await confirm({
          title: "Recharge your account",
          message: `${msg} Please recharge your account, then try again.`,
          confirmLabel: "Go to top-up",
          cancelLabel: "Stay here",
          variant: "warning",
        }).catch(() => false);
        if (goTopup) {
          navigate(topupPathForRole(user?.role));
          scrollTop();
        }
        return;
      }

      const buy = await confirm({
        title: "Registration pack required",
        message: `${baseMsg} Your balance: ${balance} credits. Buy a pack now to continue?`,
        confirmLabel: `Buy pack (${minCredits} credits)`,
        cancelLabel: "Cancel",
        variant: "warning",
      }).catch(() => false);

      if (!buy) return;

      try {
        const { data, error } = await invokeWithAuth("livestock-api", {
          body: { operation: "livestock-buy-pack" },
        });
        if (error || !data?.success) {
          const failMsg = formatInsufficientCreditsMessage(
            data?.message || error?.message || "Could not buy registration pack.",
            {
              taskCode: PACK_TASK,
              creditsCost: minCredits,
              balance,
            },
          );
          addToast({ type: "error", message: failMsg });
          return;
        }
        addToast({ type: "success", message: "Registration pack unlocked (10 animals)." });
        navigate(path, { state: navState });
        scrollTop();
      } catch (e) {
        addToast({ type: "error", message: e?.message || "Could not buy registration pack" });
      }
    },
    [
      tasksLoading,
      user?.id,
      user?.role,
      user?.credit_balance,
      getCost,
      confirm,
      navigate,
      addToast,
    ],
  );

  return { goToRegisterAnimal, tasksLoading };
}
