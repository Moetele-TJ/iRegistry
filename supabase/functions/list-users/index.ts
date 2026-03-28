import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success: false, message: "Unauthorized" },
        corsHeaders,
        401
      );
    }

    if (!isPrivilegedRole(session.role)) {
      return respond(
        { success: false, message: "Forbidden" },
        corsHeaders,
        403
      );
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role, police_station")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return respond(
        { success: false, message: error.message || "Failed to list users" },
        corsHeaders,
        500
      );
    }

    return respond(
      { success: true, users: users || [] },
      corsHeaders,
      200
    );
  } catch (err: any) {
    console.error("list-users crash:", err);
    return respond(
      { success: false, message: err.message || "Unexpected server error" },
      corsHeaders,
      500
    );
  }
});

