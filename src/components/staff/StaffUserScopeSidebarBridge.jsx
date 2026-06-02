import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Package,
  PauseCircle,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Shield,
  ShieldBan,
  Trash2,
  UserCircle,
  Wallet,
} from "lucide-react";
import AppSidebar from "../AppSidebar.jsx";
import { useSidebar } from "../../contexts/SidebarContext.jsx";
import { useStaffUserScope } from "../../contexts/StaffUserScopeContext.jsx";
import { useStaffProfileUserActions } from "../../hooks/useStaffProfileUserActions.js";
import StaffProfileActionsModals from "./StaffProfileActionsModals.jsx";
import { NAV, NAV_ACTIONS } from "../../lib/navLabels.js";

export default function StaffUserScopeSidebarBridge() {
  const {
    isActive,
    targetUser,
    sessionUser,
    exitScope,
    refreshTargetUser,
  } = useStaffUserScope();
  const { setSidebar, clearSidebar } = useSidebar();

  const actions = useStaffProfileUserActions({
    targetUser,
    sessionUser,
    onUserUpdated: refreshTargetUser,
    onAfterDelete: exitScope,
  });

  const items = useMemo(() => {
    if (!isActive || !actions.targetId) return [];

    const list = [
      {
        onClick: exitScope,
        icon: <ArrowLeft size={20} />,
        label: NAV_ACTIONS.backToUsers,
      },
      {
        onClick: actions.goToProfile,
        icon: <UserCircle size={20} />,
        label: NAV.profile,
      },
      {
        onClick: actions.goToItems,
        icon: <Package size={20} />,
        label: NAV_ACTIONS.viewItems,
      },
    ];

    if (actions.accountActive) {
      list.push(
        {
          onClick: () => actions.goToAddItemForTarget(),
          icon: <Plus size={20} />,
          label: NAV_ACTIONS.addItem,
          disabled: actions.disabled,
        },
        {
          onClick: actions.goToTopup,
          icon: <Wallet size={20} />,
          label: NAV_ACTIONS.topUp,
        },
      );
    }

    list.push({
      onClick: actions.goToTransactions,
      icon: <ReceiptText size={20} />,
      label: NAV.transactions,
    });

    if (actions.isDeleted) {
      if (actions.canAdminister) {
        list.push({
          onClick: () => void actions.quickReactivate(),
          icon: <RotateCcw size={20} />,
          label: "Restore",
          disabled: actions.disabled || actions.isSelf,
        });
      }
    } else if (actions.lockoutRestricted) {
      if (actions.canAdminister) {
        list.push(
          {
            onClick: () => void actions.quickReactivate(),
            icon: <RotateCcw size={20} />,
            label: "Reactivate",
            disabled: actions.disabled || actions.isSelf,
          },
          {
            onClick: () => void actions.handleDelete(),
            icon: <Trash2 size={20} />,
            label: "Delete",
            disabled: actions.disabled || actions.isSelf,
          },
        );
      }
    } else {
      if (actions.canAdminister && actions.accountActive) {
        list.push(
          {
            onClick: () => actions.openSuspendModal("suspended"),
            icon: <PauseCircle size={20} />,
            label: "Suspend",
            disabled: actions.disabled || actions.isSelf,
          },
          {
            onClick: () => actions.openSuspendModal("disabled"),
            icon: <ShieldBan size={20} />,
            label: "Disable",
            disabled: actions.disabled || actions.isSelf,
          },
          {
            onClick: actions.openRoleModal,
            icon: <Shield size={20} />,
            label: "Change Role",
            disabled: actions.disabled || actions.isSelf,
          },
        );
      }
      if (actions.accountActive) {
        list.push({
          onClick: actions.goToEdit,
          icon: <Pencil size={20} />,
          label: "Edit",
        });
      }
      if (actions.canAdminister) {
        list.push({
          onClick: () => void actions.handleDelete(),
          icon: <Trash2 size={20} />,
          label: "Delete",
          disabled: actions.disabled || actions.isSelf,
        });
      }
    }

    return list;
  }, [
    isActive,
    actions.targetId,
    actions.accountActive,
    actions.isDeleted,
    actions.lockoutRestricted,
    actions.canAdminister,
    actions.disabled,
    actions.isSelf,
    exitScope,
    actions.goToProfile,
    actions.goToItems,
    actions.goToAddItemForTarget,
    actions.goToTopup,
    actions.goToTransactions,
    actions.quickReactivate,
    actions.handleDelete,
    actions.openSuspendModal,
    actions.openRoleModal,
    actions.goToEdit,
  ]);

  /** Reserve main-content gutter; scoped items render in a local AppSidebar (live handlers). */
  useEffect(() => {
    if (!isActive || !targetUser) {
      clearSidebar();
      return;
    }

    setSidebar({
      visible: true,
      staffScopeRail: true,
      hoverExpand: true,
    });

    return () => {
      clearSidebar();
    };
  }, [isActive, targetUser?.id, setSidebar, clearSidebar]);

  if (!isActive) return null;

  return (
    <>
      {targetUser && items.length > 0 ? (
        <AppSidebar sidebar={{ visible: true, items, hoverExpand: true }} />
      ) : null}
      <StaffProfileActionsModals actions={actions} />
    </>
  );
}
