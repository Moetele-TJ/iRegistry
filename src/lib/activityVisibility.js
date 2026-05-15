import { normalizeRole } from "./roleUtils.js";

/** Platform role precedence (low → high). */
export const ROLE_RANK = {
  user: 0,
  police: 1,
  cashier: 2,
  admin: 3,
};

export function roleRank(role) {
  const key = normalizeRole(role);
  return Object.prototype.hasOwnProperty.call(ROLE_RANK, key) ? ROLE_RANK[key] : 0;
}

/**
 * Minimum platform role required to have performed this activity.
 */
export function minRoleRankForActivity(activity) {
  const action = String(activity?.action || "").trim().toUpperCase();
  const msg = String(activity?.message || "");
  const entityType = String(activity?.entity_type || "").toLowerCase();
  const meta =
    activity?.metadata && typeof activity.metadata === "object"
      ? activity.metadata
      : {};

  if (msg.startsWith("Administrator update:")) return ROLE_RANK.admin;

  if (
    action === "USER_CREATED" ||
    action === "USER_DELETED" ||
    action === "USER_ROLE_CHANGED" ||
    action === "USER_SESSIONS_REVOKED"
  ) {
    return ROLE_RANK.admin;
  }

  if (action.startsWith("APP_ADMIN_")) return ROLE_RANK.admin;

  if (action === "USER_STATUS_CHANGED") {
    if (meta.self_edit === true) return ROLE_RANK.user;
    return ROLE_RANK.admin;
  }

  if (
    action.includes("TOPUP") ||
    action.includes("CASHIER") ||
    action === "PAYMENT_CONFIRMED"
  ) {
    return ROLE_RANK.cashier;
  }

  if (
    action === "IMPOUND_RECORDED" ||
    action === "IMPOUND_MATCH" ||
    action.startsWith("POLICE_")
  ) {
    return ROLE_RANK.police;
  }

  if (entityType === "item") return ROLE_RANK.user;

  if (entityType === "user") {
    if (action === "USER_UPDATED") return ROLE_RANK.user;
    return ROLE_RANK.admin;
  }

  if (action.startsWith("ORG_")) {
    if (
      action.includes("MEMBER") ||
      action.includes("BULK") ||
      action.includes("INVITE")
    ) {
      return ROLE_RANK.cashier;
    }
    return ROLE_RANK.user;
  }

  return ROLE_RANK.user;
}

export function isActivityVisibleToViewer(activity, viewerId, viewerRole) {
  const actorId = activity?.actor_id ? String(activity.actor_id) : "";
  const viewer = String(viewerId);

  if (actorId && actorId !== viewer) {
    return true;
  }

  const needed = minRoleRankForActivity(activity);
  return roleRank(viewerRole) >= needed;
}

export function filterActivityForViewer(activity, viewerId, viewerRole) {
  const list = Array.isArray(activity) ? activity : [];
  return list.filter((row) => isActivityVisibleToViewer(row, viewerId, viewerRole));
}
