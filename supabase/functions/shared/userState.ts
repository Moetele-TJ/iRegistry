export type DerivedUserStatus = "active" | "suspended" | "disabled" | "deleted";

export function deriveUserStatus(row: any): DerivedUserStatus {
  if (row?.deleted_at) return "deleted";
  if (row?.disabled_at) return "disabled";
  if (row?.suspended_at) return "suspended";
  return "active";
}

export function isUserActive(row: any): boolean {
  return deriveUserStatus(row) === "active";
}

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeSignupIdNumber(idNumber: string): string {
  return idNumber.replace(/\s+/g, "").trim();
}

/** First non-deleted user row that blocks a new public signup. */
export function findBlockingSignupUser(
  rows: Array<{
    id: string;
    deleted_at?: string | null;
    disabled_at?: string | null;
    suspended_at?: string | null;
  }> | null | undefined,
): { status: DerivedUserStatus; id: string } | null {
  if (!rows?.length) return null;
  for (const row of rows) {
    const status = deriveUserStatus(row);
    if (status === "deleted") continue;
    return { status, id: String(row.id) };
  }
  return null;
}

export function signupConflictMessage(
  field: "email" | "id_number" | "phone",
  status: DerivedUserStatus,
): string {
  const label =
    field === "email"
      ? "Email address"
      : field === "id_number"
      ? "ID number"
      : "Phone number";

  switch (status) {
    case "active":
      return `The ${label} you entered is in use by an active account.`;
    case "disabled":
      return `The ${label} you entered is associated with a disabled account. Contact support if you need help.`;
    case "suspended":
      return `The ${label} you entered is associated with a suspended account. Contact support if you need help.`;
    default:
      return `The ${label} you entered cannot be used for a new account.`;
  }
}

