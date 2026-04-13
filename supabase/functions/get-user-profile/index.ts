import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";
import { deriveUserStatus } from "../shared/userState.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) {
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    const body = await req.json().catch(() => ({}));
    const requested = typeof body?.user_id === "string" ? body.user_id.trim() : "";

    let targetId = session.user_id;
    if (requested && requested !== session.user_id) {
      if (!isPrivilegedRole(session.role)) {
        return respond(
          { success: false, message: "You can only load your own profile here." },
          corsHeaders,
          403,
        );
      }
      targetId = requested;
    }

    const { data: row, error } = await supabase
      .from("users")
      .select(
        `
        id,
        first_name,
        last_name,
        id_number,
        date_of_birth,
        phone,
        email,
        email_verified,
        role,
        suspended_reason,
        suspended_at,
        disabled_reason,
        disabled_at,
        deleted_at,
        identity_verified,
        is_minor,
        village,
        ward,
        police_station,
        created_at,
        user_credits(balance)
      `,
      )
      .eq("id", targetId)
      .maybeSingle();

    if (error || !row) {
      console.error("get-user-profile:", error?.message);
      return respond({ success: false, message: "User not found" }, corsHeaders, 404);
    }

    const credit_balance =
      typeof (row as any)?.user_credits?.balance === "number"
        ? (row as any).user_credits.balance
        : 0;

    const { data: lastSessionRow } = await supabase
      .from("session_last_login")
      .select("last_login_at")
      .eq("user_id", targetId)
      .limit(1)
      .maybeSingle();

    const last_login_at =
      typeof (lastSessionRow as any)?.last_login_at === "string"
        ? (lastSessionRow as any).last_login_at
        : null;

    const normalizedUser = {
      ...(row as any),
      status: deriveUserStatus(row),
      credit_balance,
      last_login_at,
    };
    delete (normalizedUser as any).user_credits;

    return respond({ success: true, user: normalizedUser }, corsHeaders, 200);
  } catch (err) {
    console.error("get-user-profile crash:", err);
    return respond(
      {
        success: false,
        message: err instanceof Error ? err.message : "Unexpected server error",
      },
      corsHeaders,
      500,
    );
  }
});
