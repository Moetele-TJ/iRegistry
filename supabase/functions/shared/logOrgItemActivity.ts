function safeString(v: unknown) {
  if (v == null) return null;
  const s = String(v);
  return s.length ? s : null;
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Write an org item activity log entry.
 * This is intentionally flexible: keep structure in metadata.
 */
export async function logOrgItemActivity(
  supabase: any,
  {
    org_id,
    item_id,
    actor_user_id,
    action,
    message,
    metadata,
  }: {
    org_id: string;
    item_id?: string | null;
    actor_user_id?: string | null;
    action: string;
    message?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const payload = {
    org_id,
    item_id: item_id ?? null,
    actor_user_id: actor_user_id ?? null,
    action,
    message: message ?? null,
    metadata: metadata ?? null,
  };

  // Optional: lightweight dedupe key to prevent accidental double writes on retries.
  const dedupe = await sha1Hex(JSON.stringify(payload));

  const { error } = await supabase
    .from("org_item_activity_logs")
    .insert({
      ...payload,
      metadata: {
        ...(metadata ?? {}),
        dedupe,
        item_id: safeString(item_id),
      },
    });

  if (error) {
    console.error("logOrgItemActivity failed:", error.message);
  }
}

