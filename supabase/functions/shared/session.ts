// src/supabase/shared/session.ts
import { verify } from "https://deno.land/x/djwt/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function validateSession(req: Request) {
  const auth = req.headers.get("authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    throw {
      diag: "SESS-MDL-001",
      message: "Missing authorization token",
    };
  }

  const token = auth.replace("Bearer ", "");
  const secret = Deno.env.get("JWT_SECRET")!;

  let payload;
  try {
    payload = await verify(token, secret, "HS256");
  } catch {
    throw {
      diag: "SESS-MDL-002",
      message: "Invalid session token",
    };
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!session) {
    throw {
      diag: "SESS-MDL-003",
      message: "Session not found",
    };
  }

  if (new Date(session.expires_at) < new Date()) {
    throw {
      diag: "SESS-MDL-004",
      message: "Session expired",
    };
  }

  return {
    user_id: session.user_id,
    role: session.role,
  };
}