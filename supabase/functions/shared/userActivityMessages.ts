/** Human-readable labels for `users` row fields that appear in `update-user` `clean`. */
const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  police_station: "Police station",
  village: "Village",
  ward: "Ward",
  id_number: "National ID / Passport",
  date_of_birth: "Date of birth",
  role: "Role",
  suspended_reason: "Suspension details",
  suspended_at: "Suspension",
  disabled_reason: "Disable details",
  disabled_at: "Disable",
};

const STATUS_KEYS = new Set([
  "suspended_at",
  "suspended_reason",
  "disabled_at",
  "disabled_reason",
]);

/** Short labels for registry roles in user-facing timeline copy. */
const ROLE_LABELS: Record<string, string> = {
  user: "Registry user",
  admin: "Administrator",
  police: "Police",
  cashier: "Cashier",
};

export function humanizeRole(role: string): string {
  const k = String(role || "").trim().toLowerCase();
  return ROLE_LABELS[k] || k;
}

function statusChangeFragment(
  clean: Record<string, unknown>,
  keys: string[],
): string | null {
  const touchesStatus = keys.some((k) => STATUS_KEYS.has(k));
  if (!touchesStatus) return null;

  const clearingLockout =
    ("suspended_at" in clean || "disabled_at" in clean) &&
    clean.suspended_at === null &&
    clean.disabled_at === null;

  if (clearingLockout) return "Account reactivated";

  if (clean.disabled_at) return "Account disabled";
  if (clean.suspended_at) return "Account suspended";

  if ("suspended_reason" in clean && !("suspended_at" in clean)) {
    return "Suspension details updated";
  }
  if ("disabled_reason" in clean && !("disabled_at" in clean)) {
    return "Disable details updated";
  }

  return "Account status updated";
}

/**
 * Build timeline message and action code from `clean` payload applied in `update-user`.
 */
export function summarizeUserRecordUpdate(
  clean: Record<string, unknown>,
): { action: string; message: string; changedKeys: string[] } {
  const keys = Object.keys(clean).filter(
    (k) => typeof (clean as Record<string, unknown>)[k] !== "undefined",
  );
  const changedKeys = [...keys];

  const hasStatus = keys.some((k) => STATUS_KEYS.has(k));
  const hasRole = keys.includes("role");
  const profileKeys = keys.filter(
    (k) => !STATUS_KEYS.has(k) && k !== "role",
  );

  /* Status changes are always explicit in the timeline, even with role/profile in the same save. */
  let action = "USER_UPDATED";
  if (hasStatus) {
    action = "USER_STATUS_CHANGED";
  } else if (hasRole && profileKeys.length === 0) {
    action = "USER_ROLE_CHANGED";
  }

  const parts: string[] = [];
  if (hasRole && clean.role !== undefined) {
    parts.push(`Role set to ${humanizeRole(String(clean.role))}`);
  }

  const statusFrag = statusChangeFragment(clean, keys);
  if (statusFrag) parts.push(statusFrag);

  for (const k of profileKeys) {
    parts.push(FIELD_LABELS[k] || k);
  }

  const summary = parts.length ? parts.join(" · ") : "Record updated";

  return {
    action,
    message: summary,
    changedKeys,
  };
}
