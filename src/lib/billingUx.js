/** Routes for user dashboard credit UX (see Header role-based paths if these change). */
import { roleIs } from "./roleUtils.js";

export const USER_PRICING_PATH = "/userdashboard/pricing";
export const USER_TRANSACTIONS_PATH = "/userdashboard/transactions";

export function isPrivilegedRole(role) {
  return roleIs(role, "admin", "cashier");
}

/**
 * update-item: credits are taken from the item owner only when neither the actor nor the owner is admin/cashier.
 * (Mirrors supabase/functions/update-item/index.ts)
 */
export function willUpdateItemChargeOwnerWallet(actorRole, ownerRole) {
  return (
    !isPrivilegedRole(actorRole) && !isPrivilegedRole(ownerRole)
  );
}

/**
 * create-item: ADD_ITEM after free tier hits resolved owner's wallet unless actor is privileged (org absorbs)
 * or owner account is staff (exempt).
 */
export function willCreateItemChargeOwnerWallet(actorRole, ownerRole) {
  if (isPrivilegedRole(actorRole)) return false;
  if (isPrivilegedRole(ownerRole)) return false;
  return true;
}

/** create-transfer-request: requester pays unless admin/cashier. */
export function willTransferRequestChargeRequester(actorRole) {
  return !isPrivilegedRole(actorRole);
}

/** review-transfer-request (approve): owner pays unless admin/cashier. */
export function willTransferApproveChargeOwner(actorRole) {
  return !isPrivilegedRole(actorRole);
}

/**
 * Balance used for item update / mark-stolen preflight: always the registered owner's credits
 * when the server would charge the owner (otherwise N/A).
 */
export function resolveOwnerBalanceForItem(item, sessionUser) {
  const oid = item?.ownerId;
  const sid = sessionUser?.id;
  if (oid && sid && String(oid) === String(sid)) {
    return Number(sessionUser?.credit_balance ?? 0);
  }
  if (typeof item?.ownerCreditBalance === "number") {
    return item.ownerCreditBalance;
  }
  return Number(sessionUser?.credit_balance ?? 0);
}

/**
 * Attach billing payload from a failed edge-function body onto an Error for UI handling.
 */
export function attachBillingToError(err, data) {
  const e = err instanceof Error ? err : new Error(String(err));
  if (data && typeof data === "object" && data.billing?.required) {
    e.billing = data.billing;
    if (data.billing.task_code) e.taskCode = data.billing.task_code;
  }
  return e;
}

/**
 * Human-readable follow-up for insufficient credits (toasts / alerts).
 */
export function formatInsufficientCreditsMessage(
  baseMessage,
  {
    taskCode,
    creditsCost,
    balance,
    balanceLabel = "Current balance",
  } = {}
) {
  const parts = [baseMessage || "Not enough credits to complete this action."];
  if (taskCode) {
    if (typeof creditsCost === "number") {
      parts.push(`This step costs ${creditsCost} credits (${taskCode}).`);
    } else {
      parts.push(`Billing task: ${taskCode}.`);
    }
  } else if (typeof creditsCost === "number") {
    parts.push(`Credits required: ${creditsCost}.`);
  }
  if (typeof balance === "number") {
    parts.push(`${balanceLabel}: ${balance} credits.`);
  }
  parts.push(
    `Open ${USER_PRICING_PATH} for prices and ${USER_TRANSACTIONS_PATH} for top-up history, or ask a cashier to add credits.`
  );
  return parts.join(" ");
}

/**
 * Build message from an error possibly carrying `billing` / `taskCode`, plus pricing lookup.
 */
export function messageForBillingFailure(err, { getCost, balance, balanceLabel } = {}) {
  const code = err?.billing?.task_code || err?.taskCode;
  if (!err?.billing?.required && !code) {
    return err?.message || "Request failed.";
  }
  const cost = typeof getCost === "function" && code ? getCost(code) : null;
  return formatInsufficientCreditsMessage(err?.message || "Request failed.", {
    taskCode: code,
    creditsCost: cost ?? undefined,
    balance: typeof balance === "number" ? balance : undefined,
    balanceLabel: balanceLabel || "Your current balance",
  });
}

/**
 * Estimate which task codes may be charged on update-item for the current user edit.
 */
export function getEditItemPreviewCharges({
  storedItem,
  form,
  photoPreviews,
  actorRole,
  ownerRole,
}) {
  if (!willUpdateItemChargeOwnerWallet(actorRole, ownerRole)) return [];

  const codes = [];
  if (storedItem?.status === "Active" && form?.status === "Stolen") {
    codes.push("MARK_STOLEN");
  }
  if (Array.isArray(photoPreviews) && photoPreviews.length > 0) {
    codes.push("UPLOAD_PHOTOS");
  }

  const s = (v) => (v == null ? "" : String(v).trim());
  const num = (v) => (v === "" || v == null ? NaN : Number(v));

  const textChanged =
    s(form?.category) !== s(storedItem?.category) ||
    s(form?.make) !== s(storedItem?.make) ||
    s(form?.model) !== s(storedItem?.model) ||
    s(form?.serial1) !== s(storedItem?.serial1) ||
    s(form?.serial2) !== s(storedItem?.serial2) ||
    s(form?.village) !== s(storedItem?.village) ||
    s(form?.ward) !== s(storedItem?.ward) ||
    s(form?.station) !== s(storedItem?.station) ||
    s(form?.shop) !== s(storedItem?.shop) ||
    s(form?.notes) !== s(storedItem?.notes) ||
    s(form?.purchaseDate) !==
      (storedItem?.purchaseDate
        ? String(storedItem.purchaseDate).slice(0, 10)
        : "") ||
    s(form?.warrantyExpiry) !==
      (storedItem?.warrantyExpiry
        ? String(storedItem.warrantyExpiry).slice(0, 10)
        : "") ||
    num(form?.estimatedValue) !== num(storedItem?.estimatedValue);

  if (textChanged) codes.push("EDIT_ITEM");

  return codes;
}

/** Photos attached to an item (for slot / billing UX). */
export function getItemPhotoCount(item) {
  const p = item?.photos;
  if (!Array.isArray(p)) return 0;
  return p.filter((x) => x != null).length;
}

/**
 * Possible single-step charges when opening the editor (owner wallet billed).
 */
export function getEditEntryApplicableTaskCodes(item, actorRole, ownerRole) {
  if (!willUpdateItemChargeOwnerWallet(actorRole, ownerRole)) return [];

  const codes = [];
  if (item?.status === "Active") codes.push("MARK_STOLEN");
  if (getItemPhotoCount(item) < 5) codes.push("UPLOAD_PHOTOS");
  codes.push("EDIT_ITEM");
  return codes;
}

export function getMinimumCreditForAnyEditAction(
  item,
  getCost,
  actorRole,
  ownerRole
) {
  const codes = getEditEntryApplicableTaskCodes(item, actorRole, ownerRole);
  if (codes.length === 0) return null;

  let min = null;
  for (const c of codes) {
    const n = typeof getCost === "function" ? getCost(c) : null;
    if (n == null || !Number.isFinite(n)) continue;
    if (min == null || n < min) min = n;
  }
  return min;
}

export function isBalanceBelowMinimumForEdit(
  ownerBalance,
  item,
  getCost,
  actorRole,
  ownerRole
) {
  const m = getMinimumCreditForAnyEditAction(
    item,
    getCost,
    actorRole,
    ownerRole
  );
  if (m == null) return false;
  return Number(ownerBalance) < m;
}

/** ADD_ITEM cost after free registrations; null if free or no wallet charge. */
export function getAddItemChargeIfApplicable({
  createdByCount,
  actorRole,
  ownerRole,
  getCost,
}) {
  if (!willCreateItemChargeOwnerWallet(actorRole, ownerRole)) return null;
  if (createdByCount < 2) return null;
  const n = typeof getCost === "function" ? getCost("ADD_ITEM") : null;
  return n != null && Number.isFinite(n) ? n : null;
}

export function isBalanceBelowAddItemMinimum(balance, ctx) {
  const c = getAddItemChargeIfApplicable(ctx);
  if (c == null) return false;
  return Number(balance) < c;
}
