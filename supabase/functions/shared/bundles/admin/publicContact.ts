import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import { getCorsHeaders } from "../../cors.ts";
import { respond } from "../../respond.ts";
import { validateSession } from "../../validateSession.ts";
import { roleIs } from "../../roles.ts";
import { logAudit } from "../../logAudit.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SELECT =
  "operator_name, support_email, support_phone, support_whatsapp, support_address, support_hours, support_tagline, updated_at, updated_by";

function normOptionalString(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normRequiredString(v: unknown, label: string, max = 200): string {
  const s = normOptionalString(v, max);
  if (!s) throw new Error(`${label} is required`);
  return s;
}

export function mapPublicContactRow(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    operator_name: String(row.operator_name || "iRegistry").trim() || "iRegistry",
    support_email: row.support_email != null ? String(row.support_email).trim() || null : null,
    support_phone: row.support_phone != null ? String(row.support_phone).trim() || null : null,
    support_whatsapp: row.support_whatsapp != null ? String(row.support_whatsapp).trim() || null : null,
    support_address: row.support_address != null ? String(row.support_address).trim() || null : null,
    support_hours: row.support_hours != null ? String(row.support_hours).trim() || null : null,
    support_tagline: row.support_tagline != null ? String(row.support_tagline).trim() || null : null,
    updated_at: row.updated_at ?? null,
    updated_by: row.updated_by ?? null,
  };
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const session = await validateSession(supabase, auth);
  if (!session) {
    return { session: null, res: respond({ success: false, message: "Unauthorized" }, getCorsHeaders(req), 401) };
  }
  if (!roleIs(session.role, "admin")) {
    return { session: null, res: respond({ success: false, message: "Forbidden" }, getCorsHeaders(req), 403) };
  }
  return { session, res: null as Response | null };
}

export async function loadPublicContactRow() {
  const { data, error } = await supabase
    .from("public_contact_config")
    .select(SELECT)
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to load public contact");
  return mapPublicContactRow((data as Record<string, unknown>) || null);
}

export async function runGetPublicContactConfig(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const contact = await loadPublicContactRow();
    await logAudit({
      supabase,
      event: "PUBLIC_CONTACT_VIEWED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "low",
      diag: "PUB-CT-GET",
      metadata: {},
      req,
    });
    return respond({ success: true, contact }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load public contact";
    return respond({ success: false, message: msg }, corsHeaders, 500);
  }
}

export async function runUpsertPublicContact(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const gate = await requireAdmin(req);
  if (gate.res) return gate.res;
  const session = gate.session!;

  try {
    const body = await req.json().catch(() => ({}));
    const payload = {
      operator_name: normRequiredString((body as { operator_name?: unknown })?.operator_name, "Operator name", 120),
      support_email: normOptionalString((body as { support_email?: unknown })?.support_email, 254),
      support_phone: normOptionalString((body as { support_phone?: unknown })?.support_phone, 80),
      support_whatsapp: normOptionalString((body as { support_whatsapp?: unknown })?.support_whatsapp, 40),
      support_address: normOptionalString((body as { support_address?: unknown })?.support_address, 1000),
      support_hours: normOptionalString((body as { support_hours?: unknown })?.support_hours, 300),
      support_tagline: normOptionalString((body as { support_tagline?: unknown })?.support_tagline, 300),
      updated_by: session.user_id,
    };

    const { data, error } = await supabase
      .from("public_contact_config")
      .update(payload)
      .eq("id", 1)
      .select(SELECT)
      .single();

    if (error || !data) {
      return respond(
        { success: false, message: error?.message || "Failed to save public contact" },
        corsHeaders,
        500,
      );
    }

    const contact = mapPublicContactRow(data as Record<string, unknown>);
    await logAudit({
      supabase,
      event: "PUBLIC_CONTACT_UPDATED",
      user_id: String(session.user_id),
      channel: "ADMIN",
      actor_user_id: session.user_id,
      success: true,
      severity: "medium",
      diag: "PUB-CT-UP",
      metadata: { operator_name: contact?.operator_name },
      req,
    });

    return respond({ success: true, contact }, corsHeaders, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save public contact";
    const isValidation = typeof msg === "string" && msg.includes(" is required");
    return respond({ success: false, message: msg }, corsHeaders, isValidation ? 400 : 500);
  }
}
