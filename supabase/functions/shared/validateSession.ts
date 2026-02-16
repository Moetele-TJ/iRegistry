// supabase/functions/shared/validateSession.ts
import { hashToken } from "./crypto.ts";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export async function validateSession(
  supabase: any,
  authHeader: string | null
) {
  // ----------------------------------
  // 1️⃣ Check Authorization
  // ----------------------------------
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenHash = await hashToken(token);

  // ----------------------------------
  // 2️⃣ Look up session in DB
  // ----------------------------------
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id, role, expires_at, revoked")
    .eq("token", tokenHash)
    .maybeSingle();

  if (error || !session) {
    return null;
  }

  if (session.revoked) {
    return null;
  }

  // ----------------------------------
  // 3️⃣ Check expiration
  // ----------------------------------
  const now = Date.now();
  const expiresAt = new Date(session.expires_at).getTime();

  if (expiresAt < now) {
    return null;
  }

  // ----------------------------------
  // 4️⃣ Sliding expiration refresh
  // ----------------------------------
  const remainingMs = expiresAt - now;

  if (remainingMs <= REFRESH_THRESHOLD_MS) {
    const newExpiry = new Date(now + SESSION_TTL_MS);

    const { error: updateError } = await supabase
      .from("sessions")
      .update({ expires_at: newExpiry })
      .eq("id", session.id);

    if (updateError) {
    } else {
      session.expires_at = newExpiry.toISOString();
    }
  }
  return session;
}