/**
 * Normalizes credit balances from APIs (PostgREST may return int as number or string).
 * Returns a non-negative integer, or null if missing/invalid.
 */
export function parseCreditBalance(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return null;
    const n = Number(t);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return null;
}
