/**
 * Public contact for /contact.
 * Resolved order per field: database (admin Settings) → Vite env → built-in defaults.
 */

function env(key) {
  return String(import.meta.env[key] || "").trim();
}

export const PUBLIC_CONTACT_DEFAULTS = {
  operatorName: "iRegistry",
  email: "info@iregsys.com",
  phone: "+267 72293952",
  whatsapp: "26772293952",
  address: "Plot Number 60491, Block 7\nGaborone, Botswana",
  hours: "Mon–Fri 08:00–17:00 (CAT)",
  tagline: "Keeping it safe",
};

export const publicContactFromEnv = {
  operatorName: env("VITE_PUBLIC_OPERATOR_NAME") || PUBLIC_CONTACT_DEFAULTS.operatorName,
  email: env("VITE_PUBLIC_SUPPORT_EMAIL") || PUBLIC_CONTACT_DEFAULTS.email,
  phone: env("VITE_PUBLIC_SUPPORT_PHONE") || PUBLIC_CONTACT_DEFAULTS.phone,
  whatsapp: env("VITE_PUBLIC_SUPPORT_WHATSAPP") || PUBLIC_CONTACT_DEFAULTS.whatsapp,
  address: env("VITE_PUBLIC_SUPPORT_ADDRESS") || PUBLIC_CONTACT_DEFAULTS.address,
  hours: env("VITE_PUBLIC_SUPPORT_HOURS") || PUBLIC_CONTACT_DEFAULTS.hours,
  tagline: env("VITE_PUBLIC_SUPPORT_TAGLINE") || PUBLIC_CONTACT_DEFAULTS.tagline,
};

function pick(dbVal, envVal, fallback) {
  const d = dbVal != null ? String(dbVal).trim() : "";
  if (d) return d;
  const e = envVal != null ? String(envVal).trim() : "";
  if (e) return e;
  return fallback;
}

/** @param {Record<string, unknown> | null | undefined} row — API snake_case row */
export function mergePublicContact(row) {
  const envVals = publicContactFromEnv;
  const defs = PUBLIC_CONTACT_DEFAULTS;
  if (!row) return { ...envVals };

  return {
    operatorName: pick(row.operator_name, envVals.operatorName, defs.operatorName),
    email: pick(row.support_email, envVals.email, defs.email),
    phone: pick(row.support_phone, envVals.phone, defs.phone),
    whatsapp: pick(row.support_whatsapp, envVals.whatsapp, defs.whatsapp),
    address: pick(row.support_address, envVals.address, defs.address),
    hours: pick(row.support_hours, envVals.hours, defs.hours),
    tagline: pick(row.support_tagline, envVals.tagline, defs.tagline),
  };
}

export function hasPublicContactDetails(contact) {
  const c = contact || publicContactFromEnv;
  return Boolean(c.email || c.phone || c.whatsapp || c.address || c.hours);
}

export function mailtoHref(email) {
  const e = String(email || "").trim();
  return e ? `mailto:${encodeURIComponent(e)}` : null;
}

export function telHref(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function whatsappHref(number) {
  const digits = String(number || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

/** Admin form ↔ API */
export function contactRowToForm(row) {
  const c = mergePublicContact(row);
  return {
    operator_name: c.operatorName,
    support_email: c.email || "",
    support_phone: c.phone || "",
    support_whatsapp: c.whatsapp || "",
    support_address: c.address || "",
    support_hours: c.hours || "",
    support_tagline: c.tagline || "",
  };
}

export function emptyContactForm() {
  return contactRowToForm(null);
}
