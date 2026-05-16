// 📁 supabase/functions/shared/logActivity.ts
import { normalizeRole } from "./roles.ts";
import { resolveActivityActorRole } from "./resolveActivityActorRole.ts";

export async function logActivity(
  supabase: any,
  {
    actorId,
    actorRole,
    resourceOwnerUserId,
    entityType,
    entityId = null,
    entityName = null,
    action,
    message,
    metadata = null,
  }: {
    actorId: string;
    actorRole: string;
    /** Item owner or account subject — when same as actorId, privileged actors log as "user". */
    resourceOwnerUserId?: string | null;
    entityType: string;
    entityId?: string | null;
    entityName?: string | null;
    action: string;
    message: string;
    metadata?: Record<string, any> | null;
  },
) {
  const ownerFromMeta =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).ownerId ??
        (metadata as Record<string, unknown>).owner_id
      : null;

  const ownerId =
    resourceOwnerUserId ??
    (entityType === "user" && entityId ? entityId : null) ??
    ownerFromMeta;

  const loggedRole = resolveActivityActorRole(actorRole, actorId, ownerId);
  const elevated = normalizeRole(actorRole);
  const meta =
    metadata && typeof metadata === "object"
      ? { ...metadata }
      : metadata
        ? { ...(metadata as object) }
        : {};

  if (elevated && loggedRole !== elevated) {
    (meta as Record<string, unknown>).actor_role_elevated = elevated;
  }

  const { error } = await supabase.from("activity_logs").insert({
    actor_id: actorId,
    actor_role: loggedRole,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    action,
    message,
    metadata: Object.keys(meta).length ? meta : metadata,
  });

  if (error) {
    console.error("Activity log failed:", error);
  }
}
