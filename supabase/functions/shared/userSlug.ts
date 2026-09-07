// supabase/functions/shared/userSlug.ts
import { slugify } from "./slug.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUserIdUuid(value: string): boolean {
  return UUID_RE.test(String(value || "").trim());
}

/** Surname then given names → `mphuting-ntebogang`. */
export function userBaseSlug(lastName: unknown, firstName: unknown): string {
  const last = String(lastName || "").trim();
  const first = String(firstName || "").trim();
  const raw = [last, first].filter(Boolean).join("-");
  const s = slugify(raw);
  return s || "user";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function usedSlugsForBase(
  supabase: { from: (t: string) => any },
  base: string,
  excludeId?: string,
): Promise<Set<string>> {
  let query = supabase.from("users").select("id, slug").ilike("slug", `${base}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  const used = new Set<string>();
  const re = new RegExp(`^${escapeRegex(base)}(-\\d+)?$`, "i");
  for (const row of data || []) {
    const s = String((row as { slug?: string | null })?.slug || "").trim();
    if (s && re.test(s)) used.add(s.toLowerCase());
  }
  return used;
}

async function nextNumberedSlug(
  used: Set<string>,
  base: string,
): Promise<string> {
  let n = 1;
  while (used.has(`${base}-${n}`.toLowerCase())) n += 1;
  return `${base}-${n}`;
}

/** Prefer bare base; otherwise base-1, base-2, … */
export async function allocateUserSlug(opts: {
  supabase: { from: (t: string) => any };
  lastName: unknown;
  firstName: unknown;
  excludeId?: string;
}): Promise<string> {
  const base = userBaseSlug(opts.lastName, opts.firstName);
  const used = await usedSlugsForBase(opts.supabase, base, opts.excludeId);
  if (!used.has(base.toLowerCase())) return base;
  return nextNumberedSlug(used, base);
}

/**
 * On soft-delete: if the user holds the bare base slug, renumber to base-N
 * so a new active account can take the original.
 */
export async function vacateUserSlugOnDelete(opts: {
  supabase: { from: (t: string) => any };
  id: string;
  currentSlug: unknown;
  lastName: unknown;
  firstName: unknown;
}): Promise<string> {
  const base = userBaseSlug(opts.lastName, opts.firstName);
  const current = String(opts.currentSlug || "").trim();
  const numbered = new RegExp(`^${escapeRegex(base)}-\\d+$`, "i");
  if (current && numbered.test(current)) return current;

  const used = await usedSlugsForBase(opts.supabase, base, opts.id);
  return nextNumberedSlug(used, base);
}

/**
 * On restore: reclaim bare base when free; otherwise keep current numbered slug.
 */
export async function reclaimUserSlugOnRestore(opts: {
  supabase: { from: (t: string) => any };
  id: string;
  currentSlug: unknown;
  lastName: unknown;
  firstName: unknown;
}): Promise<string> {
  const base = userBaseSlug(opts.lastName, opts.firstName);
  const used = await usedSlugsForBase(opts.supabase, base, opts.id);
  if (!used.has(base.toLowerCase())) return base;

  const current = String(opts.currentSlug || "").trim();
  if (current) return current;
  return nextNumberedSlug(used, base);
}
