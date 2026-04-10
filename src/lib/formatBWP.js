/**
 * Format an amount as Botswana Pula (en-BW locale, currency symbol "P").
 * Use for read-only display of monetary values stored against items, etc.
 *
 * @param {unknown} value - Number or numeric string (commas allowed); null/undefined/empty → placeholder
 * @param {{ empty?: string }} [opts]
 * @returns {string}
 */
export function formatBwpCurrency(value, opts = {}) {
  const empty = opts.empty ?? "—";
  if (value == null || value === "") return empty;

  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());

  if (!Number.isFinite(n)) return empty;

  try {
    return new Intl.NumberFormat("en-BW", {
      style: "currency",
      currency: "BWP",
      currencyDisplay: "symbol",
    }).format(n);
  } catch {
    return empty;
  }
}

/**
 * Format a money amount with an ISO currency code (payments, reports). BWP uses `en-BW`
 * so it matches {@link formatBwpCurrency}.
 *
 * @param {string|undefined|null} currency
 * @param {unknown} amount
 * @param {{ empty?: string }} [opts]
 * @returns {string}
 */
export function formatMoneyAmount(currency, amount, opts = {}) {
  const empty = opts.empty ?? "—";
  if (amount == null) return empty;
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const cur = currency || "BWP";
  try {
    const locale = cur === "BWP" ? "en-BW" : undefined;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
      currencyDisplay: "symbol",
    }).format(n);
  } catch {
    return `${cur} ${n}`;
  }
}
