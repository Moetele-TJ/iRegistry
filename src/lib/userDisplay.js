// src/lib/userDisplay.js
/** Single-line label for pickers, tables, and sorting (name → email → ID → phone → numeric id). */
export function displayUser(u) {
  if (!u) return "";
  const first = String(u.first_name || "").trim();
  const last = String(u.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const email = String(u.email || "").trim();
  if (email) return email;
  const idNum = String(u.id_number || "").trim();
  if (idNum) return idNum;
  const phone = String(u.phone || "").trim();
  if (phone) return phone;
  if (u.id != null && String(u.id) !== "") return String(u.id);
  return "";
}

export function sortUsersAlphabetically(users) {
  const list = Array.isArray(users) ? users : [];
  return [...list].sort((a, b) => {
    const cmp = displayUser(a).localeCompare(displayUser(b), undefined, { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    const ida = a?.id != null ? String(a.id) : "";
    const idb = b?.id != null ? String(b.id) : "";
    return ida.localeCompare(idb, undefined, { numeric: true });
  });
}
