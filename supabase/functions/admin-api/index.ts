import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

import { run as runCreateUser } from "../shared/bundles/admin/createUser.ts";
import { run as runSessions } from "../shared/bundles/admin/sessions.ts";
import { run as runUpsertTask } from "../shared/bundles/admin/upsertTask.ts";
import { run as runUpsertCreditPackage } from "../shared/bundles/admin/upsertCreditPackage.ts";
import { run as runDeleteCreditPackage } from "../shared/bundles/admin/deleteCreditPackage.ts";
import {
  runGetPromoConfig,
  runSetPromoConfig,
  runUpsertPromoEnrollment,
  runDeletePromoEnrollment,
} from "../shared/bundles/admin/promoMode.ts";

const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "admin-create-user": runCreateUser,
  "admin-sessions": runSessions,
  "admin-upsert-task": runUpsertTask,
  "admin-upsert-credit-package": runUpsertCreditPackage,
  "admin-delete-credit-package": runDeleteCreditPackage,
  "admin-get-promo-config": runGetPromoConfig,
  "admin-set-promo-config": runSetPromoConfig,
  "admin-upsert-promo-user": runUpsertPromoEnrollment,
  "admin-delete-promo-user": runDeletePromoEnrollment,
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    let body: Record<string, unknown> = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return respond({ success: false, message: "Invalid JSON" }, corsHeaders, 400);
      }
    }

    const op = typeof body.operation === "string" ? body.operation : "";
    if (!op) {
      return respond({ success: false, message: "operation is required" }, corsHeaders, 400);
    }

    const handler = HANDLERS[op];
    if (!handler) {
      return respond({ success: false, message: "Unknown operation" }, corsHeaders, 400);
    }

    const { operation: _omit, ...rest } = body;
    const innerReq = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(rest),
    });

    return await handler(innerReq);
  } catch (err: unknown) {
    console.error("admin-api crash:", err);
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
