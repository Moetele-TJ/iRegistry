export const PRIVILEGED_ROLES = [
  "admin",
  "cashier",
];

export function isPrivilegedRole(role: string | null | undefined) {
  if (!role) return false;
  return PRIVILEGED_ROLES.includes(role);
}