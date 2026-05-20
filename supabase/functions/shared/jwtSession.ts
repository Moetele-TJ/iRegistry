import { verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function importJwtKey(usages: KeyUsage[]) {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

/** Resolve `sessions.id` from a bearer JWT (verified when possible; decode fallback for logout). */
export async function sessionIdFromToken(token: string): Promise<string | null> {
  const trimmed = String(token || "").trim();
  if (!trimmed) return null;

  const key = await importJwtKey(["verify"]);
  if (key) {
    try {
      const payload = await verify(trimmed, key);
      if (payload && typeof payload === "object") {
        const sid = (payload as { sid?: unknown }).sid;
        if (typeof sid === "string" && sid.trim()) return sid.trim();
      }
    } catch {
      /* expired or signature mismatch — try decode */
    }
  }

  const decoded = decodeJwtPayloadUnsafe(trimmed);
  const sid = decoded?.sid;
  return typeof sid === "string" && sid.trim() ? sid.trim() : null;
}
