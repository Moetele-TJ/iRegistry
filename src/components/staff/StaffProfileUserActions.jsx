import { useState } from "react";
import StaffProfileActionsModals from "./StaffProfileActionsModals.jsx";
import { useStaffProfileUserActions } from "../../hooks/useStaffProfileUserActions.js";
import { NAV_ACTIONS } from "../../lib/navLabels.js";

const mobileSelectClass =
  "mt-1 w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white disabled:opacity-50 box-border";

/**
 * Staff actions when viewing another user's profile (`/profile?user=…`).
 * Desktop actions live in the persistent scope sidebar; mobile keeps inline controls here.
 */
export default function StaffProfileUserActions({ targetUser, sessionUser, onUserUpdated }) {
  const actions = useStaffProfileUserActions({ targetUser, sessionUser, onUserUpdated });

  const [accountSelect, setAccountSelect] = useState("");
  const [registrySelect, setRegistrySelect] = useState("");

  const {
    disabled,
    canAdminister,
    accountActive,
    isDeleted,
    lockoutRestricted,
    showAccountDropdown,
    goToItems,
    goToTopup,
    goToTransactions,
    goToEdit,
    goToAddItemForTarget,
    openRoleModal,
    openSuspendModal,
    quickReactivate,
    handleDelete,
    isSelf,
  } = actions;

  function runAccountAction(action) {
    switch (action) {
      case "edit":
        return goToEdit();
      case "change_role":
        return openRoleModal();
      case "suspend":
        return openSuspendModal("suspended");
      case "disable":
        return openSuspendModal("disabled");
      case "reactivate":
        return void quickReactivate();
      case "delete":
        return void handleDelete();
      default:
        break;
    }
  }

  function runRegistryAction(action) {
    switch (action) {
      case "items":
        return goToItems();
      case "add_item":
        return goToAddItemForTarget();
      case "topup":
        return goToTopup();
      case "transactions":
        return goToTransactions();
      default:
        break;
    }
  }

  return (
    <>
      <StaffProfileActionsModals actions={actions} />

      <div className="lg:hidden w-full min-w-0 flex flex-col gap-2 sm:flex-row sm:gap-3">
        {showAccountDropdown ? (
          <div className="min-w-0 flex-1">
            <label className="text-xs text-gray-600" htmlFor="staff-profile-account-actions">
              Account
            </label>
            <select
              id="staff-profile-account-actions"
              value={accountSelect}
              onChange={(e) => {
                const v = e.target.value;
                setAccountSelect(v);
                if (!v) return;
                runAccountAction(v);
                setTimeout(() => setAccountSelect(""), 0);
              }}
              className={mobileSelectClass}
              disabled={disabled}
            >
              <option value="">Choose action…</option>
              {isDeleted ? (
                canAdminister ? <option value="reactivate">Restore account</option> : null
              ) : lockoutRestricted ? (
                <>
                  {canAdminister ? <option value="reactivate">Reactivate</option> : null}
                  {canAdminister ? <option value="delete">Delete user…</option> : null}
                </>
              ) : (
                <>
                  {canAdminister && accountActive ? (
                    <>
                      <option value="suspend">Suspend…</option>
                      <option value="disable">Disable…</option>
                      <option value="change_role">Change role…</option>
                    </>
                  ) : null}
                  {canAdminister && !accountActive ? (
                    <option value="reactivate">Reactivate</option>
                  ) : null}
                  {accountActive ? <option value="edit">Edit user</option> : null}
                  {canAdminister ? <option value="delete">Delete user…</option> : null}
                </>
              )}
            </select>
          </div>
        ) : (
          <p className="text-xs text-gray-500 leading-snug sm:flex-1">
            {isDeleted
              ? "Deleted accounts can only be restored by an administrator."
              : "Suspended or disabled accounts can only be reactivated or removed by an administrator."}
          </p>
        )}
        <div className="min-w-0 flex-1">
          <label className="text-xs text-gray-600" htmlFor="staff-profile-registry-actions">
            Registry
          </label>
          <select
            id="staff-profile-registry-actions"
            value={registrySelect}
            onChange={(e) => {
              const v = e.target.value;
              setRegistrySelect(v);
              if (!v) return;
              runRegistryAction(v);
              setTimeout(() => setRegistrySelect(""), 0);
            }}
            className={mobileSelectClass}
            disabled={disabled}
          >
            <option value="">Choose action…</option>
            <option value="items">{NAV_ACTIONS.viewItems}</option>
            {accountActive ? <option value="add_item">{NAV_ACTIONS.addItem}</option> : null}
            {accountActive ? <option value="topup">{NAV_ACTIONS.topUpCredits}</option> : null}
            <option value="transactions">Transactions</option>
          </select>
        </div>
      </div>
    </>
  );
}
