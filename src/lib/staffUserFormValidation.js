import { normEmail, normIdNumber, normStr, dobInputStr } from "./staffUserForm.js";
import { validatePhoneForCountry } from "./phoneCountry.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Client-side validation aligned with public signup (step 1) and admin-create-user.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateStaffUserForm(form, { isAdd = false } = {}) {
  if (!normStr(form.first_name)) {
    return { ok: false, message: "First name is required." };
  }
  if (!normStr(form.last_name)) {
    return { ok: false, message: "Last name is required." };
  }

  const idn = normIdNumber(form.id_number);
  if (!idn) {
    return { ok: false, message: "National ID / Passport is required." };
  }

  if (isAdd && !dobInputStr(form.date_of_birth)) {
    return { ok: false, message: "Date of birth is required." };
  }

  if (isAdd && dobInputStr(form.date_of_birth) && !/^\d{4}-\d{2}-\d{2}$/.test(dobInputStr(form.date_of_birth))) {
    return { ok: false, message: "Invalid date of birth (use YYYY-MM-DD)." };
  }

  const phoneCheck = validatePhoneForCountry(form.country, form.phone);
  if (!phoneCheck.ok) return phoneCheck;

  if (!normStr(form.village)) {
    return { ok: false, message: "Town / village is required." };
  }
  if (!normStr(form.ward)) {
    return { ok: false, message: "Ward / street is required." };
  }
  if (!normStr(form.police_station)) {
    return { ok: false, message: "Nearest police station is required." };
  }

  const email = normEmail(form.email);
  if (isAdd) {
    if (!email) {
      return { ok: false, message: "Email address is required." };
    }
    if (!EMAIL_RE.test(String(form.email ?? "").trim())) {
      return { ok: false, message: "Enter a valid email address." };
    }
  } else if (String(form.email ?? "").trim() && !EMAIL_RE.test(String(form.email).trim())) {
    return { ok: false, message: "Enter a valid email address." };
  }

  return { ok: true };
}
