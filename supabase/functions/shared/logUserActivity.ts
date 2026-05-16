import { normalizeRole } from "./roles.ts";
import { resolveActivityActorRole } from "./resolveActivityActorRole.ts";

export async function logUserActivity(
  supabase: any,
  {
    actorId,
    actorRole,
    targetUserId,
    targetDisplayName,
    action,
    message,
    metadata = null,
  }: {
    actorId: string;
    actorRole: string;
    targetUserId: string;
    targetDisplayName: string | null;
    action: string;
    message: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  const loggedRole = resolveActivityActorRole(
    actorRole,
    actorId,
    targetUserId,
  );
  const elevated = normalizeRole(actorRole);
  const meta =
    metadata && typeof metadata === "object" ? { ...metadata } : {};

  if (elevated && loggedRole !== elevated) {
    (meta as Record<string, unknown>).actor_role_elevated = elevated;
  }

  const { error } = await supabase.from("user_activity_logs").insert({
    user_id: targetUserId,
    actor_id: actorId,
    actor_role: loggedRole,
    user_display_name: targetDisplayName?.trim() || "User",
    action,
    message,
    metadata: Object.keys(meta).length ? meta : metadata,
  });

  if (error) {
    console.error("User activity log failed:", error);
  }
}
