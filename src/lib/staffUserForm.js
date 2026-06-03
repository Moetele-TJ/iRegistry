import { deriveUserStatus } from "./userState.js";
import { staffUsersBasePath } from "./staffUsersListView.js";

export const MSG_NOTHING_TO_SUBMIT =
  "Nothing to submit — you have not changed any information.";

export const EMPTY_STAFF_USER_FORM = {
  first_name: "",
  last_name: "",
  id_number: "",
  date_of_birth: "",
  email: "",
  phone: "",
  role: "user",
  status: "active",
  status_reason: "",
  police_station: "",
  village: "",
  ward: "",
};

export function staffUserAddPath(role) {
  return `${staffUsersBasePath(role)}/new`;
}

export function staffUserEditPath(role, userId) {
  return `${staffUsersBasePath(role)}/${encodeURIComponent(String(userId))}/edit`;
}

export function staffUsersReturnUrl(role, returnTo, highlightUserId) {
  const dest = returnTo || staffUsersBasePath(role);
  const qIdx = dest.indexOf("?");
  const path = qIdx >= 0 ? dest.slice(0, qIdx) : dest;
  const params = new URLSearchParams(qIdx >= 0 ? dest.slice(qIdx + 1) : "");
  if (highlightUserId) params.set("highlight", String(highlightUserId));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function normStr(v) {
  return String(v ?? "").trim();
}

export function normEmail(v) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export function normIdNumber(v) {
  return String(v ?? "").replace(/\s+/g, "").trim();
}

export function dobInputStr(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

export function dobFromRow(row) {
  const v = row?.date_of_birth;
  if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
  return "";
}

export function toDateInputValue(v) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function staffUserFormFromRow(u) {
  return {
    first_name: u.first_name || "",
    last_name: u.last_name || "",
    id_number: u.id_number || "",
    date_of_birth: toDateInputValue(u.date_of_birth),
    email: u.email || "",
    phone: u.phone || "",
    role: u.role || "user",
    status: deriveUserStatus(u) || "active",
    status_reason: u.suspended_reason || u.disabled_reason || "",
    police_station: u.police_station || "",
    village: u.village || "",
    ward: u.ward || "",
  };
}

/** True when the edit form differs from the server row (user management). */
export function staffUserEditHasChanges(row, form, canAdminister) {
  if (!row) return true;
  if (normStr(form.first_name) !== normStr(row.first_name)) return true;
  if (normStr(form.last_name) !== normStr(row.last_name)) return true;
  if (normEmail(form.email) !== normEmail(row.email ?? "")) return true;
  if (normStr(form.phone) !== normStr(row.phone)) return true;
  if (normStr(form.police_station) !== normStr(row.police_station)) return true;
  if (normStr(form.village) !== normStr(row.village)) return true;
  if (normStr(form.ward) !== normStr(row.ward)) return true;
  if (normIdNumber(form.id_number) !== normIdNumber(row.id_number)) return true;
  if (dobInputStr(form.date_of_birth) !== dobFromRow(row)) return true;
  if (!canAdminister) return false;

  const prev = deriveUserStatus(row);
  if (String(form.role || "user").toLowerCase() !== String(row.role || "user").toLowerCase()) {
    return true;
  }
  if (String(form.status || "active") !== prev) return true;

  const reason = normStr(form.status_reason);
  if (prev === "suspended" && reason !== normStr(row.suspended_reason)) return true;
  if (prev === "disabled" && reason !== normStr(row.disabled_reason)) return true;

  return false;
}
