import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success: false, message: "Invalid session" },
        corsHeaders,
        401,
      );
    }

    const body = await req.json().catch(() => ({}));
    const { userId } = body ?? {};

    if (!userId || typeof userId !== "string") {
      return respond(
        { success: false, message: "userId is required" },
        corsHeaders,
        400,
      );
    }

    if (
      String(session.user_id) !== String(userId) &&
      !isPrivilegedRole(session.role)
    ) {
      return respond(
        {
          success: false,
          message: "You can only view activity for your own account.",
        },
        corsHeaders,
        403,
      );
    }

    const { data: rows, error } = await supabase
      .from("user_activity_logs")
      .select(
        `
        id,
        user_id,
        user_display_name,
        action,
        message,
        metadata,
        created_at,
        actor_id,
        actor_role
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const activity = (rows || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      entity_type: "user",
      entity_id: r.user_id,
      entity_name: r.user_display_name,
      action: r.action,
      message: r.message,
      metadata: r.metadata,
      created_at: r.created_at,
      actor_id: r.actor_id,
      actor_role: r.actor_role,
    }));

    return respond(
      {
        success: true,
        activity,
      },
      corsHeaders,
      200,
    );
  } catch (err) {
    console.error("get-user-activity crash:", err);

    return respond(
      {
        success: false,
        message: "Failed to fetch user activity",
      },
      corsHeaders,
      500,
    );
  }
});
