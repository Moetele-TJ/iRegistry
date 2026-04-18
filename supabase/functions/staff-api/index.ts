import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";

import { run as runListOrgMembers } from "../shared/bundles/staff/listOrgMembers.ts";
import { run as runUpdateOrgMemberUser } from "../shared/bundles/staff/updateOrgMemberUser.ts";
import { run as runLookupUser } from "../shared/bundles/staff/lookupUser.ts";
import { run as runListOrgsSummary } from "../shared/bundles/staff/listOrgsSummary.ts";
import { run as runCreateOrgMember } from "../shared/bundles/staff/createOrgMember.ts";
import { run as runCompleteOrgItemTransferRequest } from "../shared/bundles/staff/completeOrgItemTransferRequest.ts";
import { run as runCompletePendingTopup } from "../shared/bundles/staff/completePendingTopup.ts";

const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  "staff-list-org-members": runListOrgMembers,
  "staff-update-org-member-user": runUpdateOrgMemberUser,
  "staff-lookup-user": runLookupUser,
  "staff-list-orgs-summary": runListOrgsSummary,
  "staff-create-org-member": runCreateOrgMember,
  "staff-complete-org-item-transfer-request": runCompleteOrgItemTransferRequest,
  "staff-complete-pending-topup": runCompletePendingTopup,
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
    console.error("staff-api crash:", err);
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
