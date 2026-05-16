import { normalizeRole } from "./roleUtils.js";
import { isPrivilegedRole } from "./billingUx.js";

/**
 * Display role for an activity row (handles historical logs before server-side fix).
 */
export function displayActivityActorRole(event, { resourceOwnerUserId } = {}) {
  const actorRole = event?.actor_role;
  const actorId = event?.actor_id ? String(event.actor_id) : "";
  const meta = event?.metadata && typeof event.metadata === "object" ? event.metadata : {};

  const owner =
    resourceOwnerUserId ??
    meta.ownerId ??
    meta.owner_id ??
    (event?.entity_type === "user" ? event?.entity_id : null);

  const ownerStr = owner ? String(owner).trim() : "";
  const normalized = normalizeRole(actorRole) || "user";

  if (!isPrivilegedRole(normalized)) return normalized;
  if (meta.self_edit === true) return "user";
  if (actorId && ownerStr && actorId === ownerStr) return "user";

  return normalized;
}
