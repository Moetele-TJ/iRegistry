// supabase/functions/shared/validateSession.ts

import { hashToken } from "./crypto.ts";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export async function validateSession(
  supabase: any,
  authHeader: string | null
) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenHash = await hashToken(token);

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id, role, expires_at, revoked")
    .eq("token", tokenHash)
    .maybeSingle();

  if (error || !session) return null;
  if (session.revoked) return null;

  const now = Date.now();
  const expiresAt = new Date(session.expires_at).getTime();

  if (expiresAt < now) return null;

  const remainingMs = expiresAt - now;

  // 🔄 Sliding expiration
  if (remainingMs <= REFRESH_THRESHOLD_MS) {
    const newExpiry = new Date(now + SESSION_TTL_MS);

    await supabase
      .from("sessions")
      .update({ expires_at: newExpiry })
      .eq("id", session.id);

    session.expires_at = newExpiry.toISOString();
  }

  return session;
}