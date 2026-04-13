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

  let action = "USER_UPDATED";
  if (hasRole && !hasStatus && profileKeys.length === 0) {
    action = "USER_ROLE_CHANGED";
  } else if (hasStatus && !hasRole && profileKeys.length === 0) {
    action = "USER_STATUS_CHANGED";
  }

  const parts: string[] = [];
  if (hasRole && clean.role !== undefined) {
    parts.push(`role → ${String(clean.role)}`);
  }
  if (hasStatus) {
    parts.push("account status / lockout");
  }
  for (const k of profileKeys) {
    const label = FIELD_LABELS[k] || k;
    parts.push(label);
  }

  const summary = parts.length
    ? parts.join(", ")
    : "Record updated";

  return {
    action,
    message: summary,
    changedKeys,
  };
}
