// supabase/shared/logItemAudit.ts
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type ItemAuditAction =
  | "ITEM_CREATED"
  | "ITEM_UPDATED"
  | "ITEM_SOFT_DELETED"
  | "ITEM_RESTORED"
  | "ITEM_HARD_DELETED"
  | "ITEM_OWNERSHIP_TRANSFERRED";

type ItemAuditDetails = {
  changes?: Record<
    string,
    {
      from: unknown;
      to: unknown;
    }
  >;
  metadata?: Record<string, unknown>;
};

interface LogItemAuditParams {
  supabase: SupabaseClient;
  itemId: string;
  actorId: string;
  action: ItemAuditAction;
  details?: ItemAuditDetails;
}

export async function logItemAudit({
  supabase,
  itemId,
  actorId,
  action,
  details = {},
}: LogItemAuditParams) {
  const { error } = await supabase.from("item_audit_logs").insert({
    item_id: itemId,
    actor_id: actorId,
    action,
    details,
  });

  if (error) {
    // We do NOT throw by default — audit failure should not block core action
    console.error("ITEM AUDIT LOG FAILED:", {
      itemId,
      actorId,
      action,
      error: error.message,
    });
  }
}