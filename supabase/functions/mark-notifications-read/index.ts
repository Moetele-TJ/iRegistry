//  supabase/functions/mark-notifications-read/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {

  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS")
    {
    return new Response(null,
      {
        status: 204,
        headers: corsHeaders 
      }
    );
  }

  try {

    const auth =
      req.headers.get("authorization") ||
      req.headers.get("Authorization");

    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        {
          success: false,
          message: "Invalid session"
        },
        corsHeaders,
        401
      );
    }

    const userId = session.user_id;

    const { error } = await supabase
      .from("item_notifications")
      .update({ isread: true })
      .eq("ownerid", userId)
      .eq("recipient_type", "owner")
      .eq("isread", false);

    if (error) throw error;

    return respond(
      {
        success: true
      },
      corsHeaders,
      200
    );

  } catch (err) {

    console.error("mark-notifications-read crash:", err);

    return respond(
      {
        success: false,
        message: "Failed to update notifications"
      },
      corsHeaders,
      500
    );
  }
});