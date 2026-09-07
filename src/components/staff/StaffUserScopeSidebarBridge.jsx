import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Package,
  PauseCircle,
  PawPrint,
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
import { staffBasePath } from "../../hooks/useStaffProfileUserActions.js";

function actionItem(item) {
  return { ...item, variant: "action" };
}

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

  const base = staffBasePath(sessionUser?.role);

  const sections = useMemo(() => {
    if (!isActive || !actions.targetId) return [];

    const navItems = [
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
      {
        to: `${base}/livestock`,
        icon: <PawPrint size={20} />,
        label: NAV.livestock,
        subItems: [
          { to: `${base}/livestock`, label: NAV.activeAnimals, end: true },
          { to: `${base}/livestock/missing`, label: NAV.missingAnimals, end: true },
          { to: `${base}/livestock/recovered`, label: NAV.recoveredAnimals, end: true },
          { to: `${base}/livestock/deleted`, label: NAV.deletedAnimals, end: true },
        ],
      },
    ];

    if (actions.accountActive) {
      navItems.push(
        {
          onClick: () => actions.goToRegisterAnimalForTarget(),
          icon: <Plus size={20} />,
          label: NAV_ACTIONS.registerAnimalForUser,
          disabled: actions.disabled,
        },
        {
          onClick: actions.goToTopup,
          icon: <Wallet size={20} />,
          label: NAV_ACTIONS.topUp,
        },
      );
    }

    navItems.push({
      onClick: actions.goToTransactions,
      icon: <ReceiptText size={20} />,
      label: NAV.transactions,
    });

    if (actions.accountActive) {
      navItems.push({
        onClick: actions.goToEdit,
        icon: <Pencil size={20} />,
        label: NAV_ACTIONS.editUser,
      });
    }

    const accountItems = [];

    if (actions.isDeleted) {
      if (actions.canAdminister) {
        accountItems.push(
          actionItem({
            onClick: () => void actions.quickReactivate(),
            icon: <RotateCcw size={20} />,
            label: "Restore",
            disabled: actions.disabled || actions.isSelf,
          }),
        );
      }
    } else if (actions.lockoutRestricted) {
      if (actions.canAdminister) {
        accountItems.push(
          actionItem({
            onClick: () => void actions.quickReactivate(),
            icon: <RotateCcw size={20} />,
            label: "Reactivate",
            disabled: actions.disabled || actions.isSelf,
          }),
          actionItem({
            onClick: () => void actions.handleDelete(),
            icon: <Trash2 size={20} />,
            label: "Delete",
            disabled: actions.disabled || actions.isSelf,
          }),
        );
      }
    } else {
      if (actions.canAdminister && actions.accountActive) {
        accountItems.push(
          actionItem({
            onClick: () => actions.openSuspendModal("suspended"),
            icon: <PauseCircle size={20} />,
            label: "Suspend",
            disabled: actions.disabled || actions.isSelf,
          }),
          actionItem({
            onClick: () => actions.openSuspendModal("disabled"),
            icon: <ShieldBan size={20} />,
            label: "Disable",
            disabled: actions.disabled || actions.isSelf,
          }),
          actionItem({
            onClick: actions.openRoleModal,
            icon: <Shield size={20} />,
            label: "Change Role",
            disabled: actions.disabled || actions.isSelf,
          }),
        );
      }
      if (actions.canAdminister) {
        accountItems.push(
          actionItem({
            onClick: () => void actions.handleDelete(),
            icon: <Trash2 size={20} />,
            label: "Delete",
            disabled: actions.disabled || actions.isSelf,
          }),
        );
      }
    }

    const result = [{ id: "nav", items: navItems }];
    if (accountItems.length > 0) {
      result.push({
        id: "account",
        label: NAV_ACTIONS.accountActions,
        items: accountItems,
      });
    }
    return result;
  }, [
    isActive,
    base,
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
    actions.goToRegisterAnimalForTarget,
    actions.goToTopup,
    actions.goToTransactions,
    actions.goToEdit,
    actions.quickReactivate,
    actions.handleDelete,
    actions.openSuspendModal,
    actions.openRoleModal,
  ]);

  const hasSidebarContent = sections.some((s) => (s.items?.length || 0) > 0);

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
      {targetUser && hasSidebarContent ? (
        <AppSidebar sidebar={{ visible: true, sections, hoverExpand: true }} />
      ) : null}
      <StaffProfileActionsModals actions={actions} />
    </>
  );
}
