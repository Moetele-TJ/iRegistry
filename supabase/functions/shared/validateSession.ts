// supabase/functions/shared/validateSession.ts
import { hashToken } from "./crypto.ts";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

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
    // 4️⃣ Sliding expiration refresh
    // ----------------------------------
    const remainingMs = expiresAt - now;

    let newToken: string | null = null;

    if (remainingMs <= REFRESH_THRESHOLD_MS) {

      const newExpiry = new Date(now + SESSION_TTL_MS);

      const { error: updateError } = await supabase
        .from("sessions")
        .update({ expires_at: newExpiry })
        .eq("id", session.id)
        .eq("revoked", false);

      if (!updateError) {

        const JWT_SECRET = Deno.env.get("JWT_SECRET")!;

        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(JWT_SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );

        const nowSec = Math.floor(Date.now() / 1000);

        const payload = {
          iss: "iregsys",
          aud: "authenticated",
          sub: session.user_id,
          role: session.role,
          sid: session.id,
          iat: nowSec,
          exp: nowSec + 3600,
          ver: 1
        };

        newToken = await create(
          { alg: "HS256", typ: "JWT" },
          payload,
          key
        );
      }
    }

    return {
      ...session,
      new_token: newToken
    };

  }