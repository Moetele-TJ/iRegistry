import { roleIs } from "./roles.ts";

export type OrgRole = "ORG_ADMIN" | "ORG_MANAGER" | "ORG_MEMBER";
export type OrgMemberStatus = "INVITED" | "ACTIVE" | "REJECTED" | "REMOVED";

export async function getActiveOrgMembership(
  supabase: any,
  {
    orgId,
    userId,
  }: {
    orgId: string;
    userId: string;
  },
): Promise<{ role: OrgRole } | null> {
  const { data, error } = await supabase
    .from("org_members")
    .select("role, status")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== "ACTIVE") return null;
  return { role: data.role as OrgRole };
}

export function orgRoleIs(role: unknown, ...expected: OrgRole[]) {
  const r = String(role ?? "").trim().toUpperCase();
  return expected.some((e) => String(e).trim().toUpperCase() === r);
}

export function isOrgPrivileged(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN", "ORG_MANAGER");
}

export function canOrgDeleteItem(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN");
}

export function canOrgTransferItem(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN");
}

export function canOrgRestoreLegacy(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN");
}

export function canOrgMarkLegacy(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN", "ORG_MANAGER");
}

export function canOrgEditItem(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN", "ORG_MANAGER");
}

export function canOrgAssign(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN", "ORG_MANAGER");
}

export function canOrgResolveStolen(role: unknown) {
  return orgRoleIs(role, "ORG_ADMIN", "ORG_MANAGER");
}

export function isAppAdmin(sessionRole: unknown) {
  return roleIs(sessionRole as any, "admin");
}

