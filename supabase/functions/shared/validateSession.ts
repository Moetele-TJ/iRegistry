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
  if (!authHeader) {
    console.log("❌ Missing or invalid Authorization header");
    return null;
  }

  const token = authHeader;
  const tokenHash = await hashToken(token);

  console.log("🔐 Incoming token hash:", tokenHash);

  // ----------------------------------
  // 2️⃣ Look up session in DB
  // ----------------------------------
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id, role, expires_at, revoked, token")
    .eq("token", tokenHash)
    .maybeSingle();

  console.log("📦 DB session row:", session);
  console.log("🧾 DB token hash:", session?.token);

  if (error) {
    console.log("❌ DB error while validating session:", error.message);
    return null;
  }

  if (!session) {
    console.log("❌ No matching session found");
    return null;
  }

  if (session.revoked) {
    console.log("❌ Session has been revoked");
    return null;
  }

  // ----------------------------------
  // 3️⃣ Check expiration
  // ----------------------------------
  const now = Date.now();
  const expiresAt = new Date(session.expires_at).getTime();

  if (expiresAt < now) {
    console.log("❌ Session expired");
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
      console.log("⚠️ Failed to refresh session expiry:", updateError.message);
    } else {
      console.log("🔄 Session expiry refreshed");
      session.expires_at = newExpiry.toISOString();
    }
  }

  console.log("✅ Session validated successfully");

  return session;
}