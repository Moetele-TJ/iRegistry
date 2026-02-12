// supabase/functions/validate-session/index.ts
import { validateSession } from "../shared/validateSession.ts";

const auth = req.headers.get("authorization");

const session = await validateSession(supabase, auth);

if (!session) {
  return respond({
    success: false,
    diag: "VAL-SESS-002",
    message: "Invalid session",
  });
}