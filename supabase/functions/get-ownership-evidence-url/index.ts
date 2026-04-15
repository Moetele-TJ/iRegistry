import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { isPrivilegedRole, roleIs } from "../shared/roles.ts";
import { getActiveOrgMembership, orgRoleIs } from "../shared/orgAuth.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function parseFileId(fileId: string) {
  const raw = String(fileId || "").trim().replace(/^\/+/, "");
  const idx = raw.indexOf("/");
  if (idx === -1) return null;
  const bucket = raw.slice(0, idx);
  const path = raw.slice(idx + 1);
  if (!bucket || !path) return null;
  return { bucket, path };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const session = await validateSession(supabase, auth);
    if (!session) return respond({ success: false, message: "Unauthorized" }, corsHeaders, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const fileId = typeof body?.file_id === "string" ? body.file_id : "";
    const itemId = typeof body?.item_id === "string" ? body.item_id : "";
    const orgId = typeof body?.org_id === "string" ? body.org_id : "";
    const expiresSeconds = Math.min(Math.max(Number(body?.expires_seconds) || 120, 30), 600);

    if (!fileId) return respond({ success: false, message: "file_id is required" }, corsHeaders, 400);

    const parsed = parseFileId(fileId);
    if (!parsed) return respond({ success: false, message: "Invalid file_id" }, corsHeaders, 400);

    const isStaff = isPrivilegedRole(session.role);
    const isAppAdmin = roleIs(session.role, "admin");

    // If not staff/app admin, require org admin membership for the item org.
    if (!isStaff && !isAppAdmin) {
      if (!itemId || !orgId) {
        return respond({ success: false, message: "item_id and org_id are required" }, corsHeaders, 400);
      }
      const { data: item } = await supabase
        .from("items")
        .select("id, owner_org_id, deletedat")
        .eq("id", itemId)
        .maybeSingle();
      if (!item || item.deletedat) return respond({ success: false, message: "Item not found" }, corsHeaders, 404);
      if (String(item.owner_org_id || "") !== String(orgId)) {
        return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
      }
      const m = await getActiveOrgMembership(supabase, { orgId, userId: session.user_id });
      if (!m || !orgRoleIs(m.role, "ORG_ADMIN")) {
        return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
      }
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresSeconds);

    if (signErr || !signed?.signedUrl) {
      return respond({ success: false, message: "Failed to sign URL" }, corsHeaders, 500);
    }

    return respond({ success: true, url: signed.signedUrl }, corsHeaders, 200);
  } catch (err: any) {
    console.error("get-ownership-evidence-url crash:", err);
    return respond({ success: false, message: err?.message || "Unexpected server error" }, corsHeaders, 500);
  }
});

