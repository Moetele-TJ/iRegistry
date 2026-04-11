/** Routes for user dashboard credit UX (see Header role-based paths if these change). */
export const USER_PRICING_PATH = "/userdashboard/pricing";
export const USER_TRANSACTIONS_PATH = "/userdashboard/transactions";

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
    parts.push(`Your current balance: ${balance} credits.`);
  }
  parts.push(
    `Open ${USER_PRICING_PATH} for prices and ${USER_TRANSACTIONS_PATH} for top-up history, or ask a cashier to add credits.`
  );
  return parts.join(" ");
}

/**
 * Build message from an error possibly carrying `billing` / `taskCode`, plus pricing lookup.
 */
export function messageForBillingFailure(err, { getCost, balance } = {}) {
  const code = err?.billing?.task_code || err?.taskCode;
  if (!err?.billing?.required && !code) {
    return err?.message || "Request failed.";
  }
  const cost = typeof getCost === "function" && code ? getCost(code) : null;
  return formatInsufficientCreditsMessage(err?.message || "Request failed.", {
    taskCode: code,
    creditsCost: cost ?? undefined,
    balance: typeof balance === "number" ? balance : undefined,
  });
}

/**
 * Estimate which task codes may be charged on update-item for the current user edit (non-privileged owner path).
 */
export function getEditItemPreviewCharges({
  storedItem,
  form,
  photoPreviews,
  actorRole,
}) {
  const privileged = ["admin", "cashier"].includes(
    String(actorRole || "").toLowerCase()
  );
  if (privileged) return [];

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
 * Task codes that could each be billed alone on a future save (user not admin/cashier).
 * Used to compute the *cheapest* possible paid step so we can warn before opening the editor.
 */
export function getEditEntryApplicableTaskCodes(item, actorRole) {
  const privileged = ["admin", "cashier"].includes(
    String(actorRole || "").toLowerCase()
  );
  if (privileged) return [];

  const codes = [];
  if (item?.status === "Active") codes.push("MARK_STOLEN");
  if (getItemPhotoCount(item) < 5) codes.push("UPLOAD_PHOTOS");
  codes.push("EDIT_ITEM");
  return codes;
}

/**
 * Minimum credits required to perform at least one billable edit action (single step).
 * Returns null if no charge applies or prices are unknown.
 */
export function getMinimumCreditForAnyEditAction(item, getCost, actorRole) {
  const codes = getEditEntryApplicableTaskCodes(item, actorRole);
  if (codes.length === 0) return null;

  let min = null;
  for (const c of codes) {
    const n = typeof getCost === "function" ? getCost(c) : null;
    if (n == null || !Number.isFinite(n)) continue;
    if (min == null || n < min) min = n;
  }
  return min;
}

export function isBalanceBelowMinimumForEdit(balance, item, getCost, actorRole) {
  const m = getMinimumCreditForAnyEditAction(item, getCost, actorRole);
  if (m == null) return false;
  return Number(balance) < m;
}

/** ADD_ITEM cost after free registrations; null if free or staff. */
export function getAddItemChargeIfApplicable({ createdByCount, privileged, getCost }) {
  if (privileged) return null;
  if (createdByCount < 2) return null;
  const n = typeof getCost === "function" ? getCost("ADD_ITEM") : null;
  return n != null && Number.isFinite(n) ? n : null;
}

export function isBalanceBelowAddItemMinimum(balance, ctx) {
  const c = getAddItemChargeIfApplicable(ctx);
  if (c == null) return false;
  return Number(balance) < c;
}
