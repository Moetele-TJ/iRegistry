//  supabase/functions/get-pending-transfer-requests/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { validateSession } from "../shared/validateSession.ts";
import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

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
    const auth = req.headers.get("authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond(
        { success: false,
          message: "Unauthorized"
        },
        corsHeaders,
        401
      );
    }

    const { data, error } = await supabase
      .from("item_transfer_requests")
      .select(`
        id,
        item_id,
        message,
        created_at,
        expires_at,
        items (
          id,
          name
        ),
        users!item_transfer_requests_requester_id_fkey (
          id,
          first_name,
          last_name
        )
      `)
      .eq("current_owner_id", session.user_id)
      .eq("status", "PENDING")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return respond(
        {
          success: false,
          message: error.message
        }, 
        corsHeaders,
        400
      );
    }

    return respond(
      {
        success: true,
        data
      },
      corsHeaders,
      200
    );

  } catch (err) {
    return respond(
      {
        success: false,
        message: "Unexpected error"
      },
      corsHeaders,
      500
    );
  }
});