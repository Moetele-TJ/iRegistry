// 📁 supabase/functions/shared/logActivity.ts
export async function logActivity(
  supabase: any,
  {
    actorId,
    actorRole,
    entityType,
    entityId = null,
    entityName = null,
    action,
    message,
    metadata = null,
  }: {
    actorId: string;
    actorRole: string;
    entityType: string;
    entityId?: string | null;
    entityName?: string | null;
    action: string;
    message: string;
    metadata?: Record<string, any> | null;
  }
) {
  const { error } = await supabase
    .from("activity_logs")
    .insert({
      actor_id: actorId,
      actor_role: actorRole,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      action,
      message,
      metadata,
    });

  if (error) {
    console.error("Activity log failed:", error);
  }
}