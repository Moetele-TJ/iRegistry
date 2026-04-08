// supabase/functions/shared/validateSession.ts
import { hashToken } from "./crypto.ts";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

/** Session length from last successful activity (sliding window). */
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export type ValidateSessionOptions = {
  /**
   * When true (validate-session endpoint only), mint a new JWT so the client can
   * replace `localStorage.session` with a fresh `exp` claim.
   */
  rotateJwt?: boolean;
};

export async function validateSession(
  supabase: any,
  authHeader: string | null,
  options: ValidateSessionOptions = {},
) {
  const { rotateJwt = false } = options;

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
    .eq("revoked", false)
    .maybeSingle();

  if (error || !session) {
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
  // 4️⃣ Sliding expiration — extend on every authenticated request
  // ----------------------------------
  const newExpiry = new Date(now + SESSION_TTL_MS);

  let updateError: unknown = null;
  let newToken: string | null = null;

  if (rotateJwt) {
    const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const ttlSec = Math.floor(SESSION_TTL_MS / 1000);

    const payload = {
      iss: "iregsys",
      aud: "authenticated",
      sub: session.user_id,
      role: session.role,
      sid: session.id,
      iat: nowSec,
      exp: nowSec + ttlSec,
      ver: 1,
    };

    newToken = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key,
    );

    const newTokenHash = await hashToken(newToken);

    const { error: rotErr } = await supabase
      .from("sessions")
      .update({ expires_at: newExpiry, token: newTokenHash })
      .eq("id", session.id)
      .eq("revoked", false);

    updateError = rotErr;
  } else {
    const { error: slideErr } = await supabase
      .from("sessions")
      .update({ expires_at: newExpiry })
      .eq("id", session.id)
      .eq("revoked", false);

    updateError = slideErr;
  }

  if (updateError) {
    console.error("validateSession: failed to update session", updateError);
  }

  if (rotateJwt && updateError) {
    newToken = null;
  }

  return {
    ...session,
    expires_at: updateError
      ? session.expires_at
      : newExpiry.toISOString(),
    new_token: newToken,
  };
}
