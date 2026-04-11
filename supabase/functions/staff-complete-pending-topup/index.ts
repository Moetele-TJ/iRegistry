import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

  if (req.method !== "POST") {
    return respond({ success: false, message: "Method not allowed" }, corsHeaders, 405);
  }

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);

    if (!session) {
      return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);
    }

    if (!isPrivilegedRole(session.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }

    const body = await req.json().catch(() => null);
    const paymentId = typeof body?.payment_id === "string" ? body.payment_id.trim() : "";
    const receiptNo = typeof body?.receipt_no === "string" ? body.receipt_no.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

    if (!paymentId) {
      return respond({ success: false, message: "payment_id is required" }, corsHeaders, 400);
    }
    if (!receiptNo) {
      return respond({ success: false, message: "receipt_no is required" }, corsHeaders, 400);
    }

    const { data: rows, error: rpcErr } = await supabase.rpc("confirm_pending_topup_staff", {
      p_payment_id: paymentId,
      p_staff_id: session.user_id,
      p_receipt_no: receiptNo,
      p_extra_metadata: { note: note || null },
    });

    const row = rows?.[0] as { success?: boolean; new_balance?: number; message?: string } | undefined;

    if (rpcErr) {
      const em = String(rpcErr.message || "");
      console.error("confirm_pending_topup_staff:", em);
      return respond(
        {
          success: false,
          message: em.includes("ADD_CREDITS_FAILED") ? "Could not credit wallet" : em || "Failed to complete",
        },
        corsHeaders,
        500,
      );
    }

    if (!row?.success) {
      return respond(
        {
          success: false,
          message: row?.message || "Could not complete pending top-up",
        },
        corsHeaders,
        400,
      );
    }

    return respond(
      {
        success: true,
        new_balance: row.new_balance ?? null,
        message: "Top-up completed.",
      },
      corsHeaders,
      200,
    );
  } catch (err: unknown) {
    console.error("staff-complete-pending-topup crash:", err);
    return respond(
      { success: false, message: err instanceof Error ? err.message : "Unexpected server error" },
      corsHeaders,
      500,
    );
  }
});
