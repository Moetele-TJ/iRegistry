/** Canonical agent codes: IR-1001 upward. Input is case/space/dash insensitive. */
export function normalizeAgentNumber(raw: unknown): string | null {
  if (raw == null) return null;
  const compact = String(raw).trim().replace(/[\s-]+/g, "").toUpperCase();
  if (!compact) return null;

  const match = compact.match(/^IR(\d+)$/);
  if (!match) return null;

  const num = Number.parseInt(match[1], 10);
  if (!Number.isFinite(num) || num < 1001) return null;

  return `IR-${num}`;
}
