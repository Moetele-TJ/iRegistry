import { isPrivilegedRole, normalizeRole } from "./roles.ts";

/**
 * Role stored on activity rows for display and feed filtering.
 * Privileged users acting on their own items/account log as "user".
 * Elevated role is preserved when acting on another user's resources.
 */
export function resolveActivityActorRole(
  actorRole: string | null | undefined,
  actorUserId: string | null | undefined,
  resourceOwnerUserId?: string | null,
): string {
  const normalized = normalizeRole(actorRole) || "user";
  if (!isPrivilegedRole(normalized)) return normalized;

  const actor = actorUserId ? String(actorUserId).trim() : "";
  const owner = resourceOwnerUserId ? String(resourceOwnerUserId).trim() : "";
  if (actor && owner && actor === owner) {
    return "user";
  }

  return normalized;
}
