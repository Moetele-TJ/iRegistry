import { normalizeSerial } from "./serial.ts";

export type SerialLookupOpts = {
  /** Select string passed to supabase-js .select(...) */
  select: string;
  includeDeleted?: boolean;
  includeLegacy?: boolean;
};

export function normalizeSerialList(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const v of raw || []) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) continue;
    const n = normalizeSerial(s);
    if (n) out.push(n);
  }
  // de-dupe while preserving order
  return [...new Set(out)];
}

export function buildSerialNormalizedOrClause(serialsNormalized: string[]): string {
  const parts: string[] = [];
  for (const n of serialsNormalized || []) {
    const clean = String(n || "").trim();
    if (!clean) continue;
    parts.push(`serial1_normalized.eq.${clean}`);
    parts.push(`serial2_normalized.eq.${clean}`);
  }
  return parts.join(",");
}

export async function lookupActiveItemBySerials(
  supabase: any,
  serialsNormalized: string[],
  opts: SerialLookupOpts,
): Promise<{ item: any | null }> {
  const orClause = buildSerialNormalizedOrClause(serialsNormalized);
  if (!orClause) return { item: null };

  let q = supabase.from("items").select(opts.select).or(orClause).limit(1);
  if (!opts.includeDeleted) q = q.is("deletedat", null);
  if (!opts.includeLegacy) q = q.is("legacyat", null);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return { item: data ?? null };
}

export async function lookupActiveItemBySerialRaw(
  supabase: any,
  serialRaw: unknown,
  opts: SerialLookupOpts,
): Promise<{ serial_normalized: string; item: any | null }> {
  const raw = typeof serialRaw === "string" ? serialRaw.trim() : "";
  const normalized = raw ? normalizeSerial(raw) : "";
  if (!normalized) return { serial_normalized: "", item: null };
  const { item } = await lookupActiveItemBySerials(supabase, [normalized], opts);
  return { serial_normalized: normalized, item };
}

