export function verifyTabFromSearch(searchParams) {
  const raw = String(searchParams?.get?.("tab") || "").trim().toLowerCase();
  return raw === "livestock" ? "livestock" : "items";
}

export function searchParamsWithVerifyTab(searchParams, tab) {
  const next = new URLSearchParams(searchParams);
  if (tab === "livestock") next.set("tab", "livestock");
  else next.delete("tab");
  return next;
}
