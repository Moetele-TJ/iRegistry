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
  const { error } = await supabase.from("user_activity_logs").insert({
    user_id: targetUserId,
    actor_id: actorId,
    actor_role: actorRole,
    user_display_name: targetDisplayName?.trim() || "User",
    action,
    message,
    metadata,
  });

  if (error) {
    console.error("User activity log failed:", error);
  }
}
