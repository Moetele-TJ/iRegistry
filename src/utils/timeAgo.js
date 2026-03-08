// src/utils/timeAgo.js
export function timeAgo(date) {
  if (!date) return "";

  const now = Date.now();
  const ts = new Date(date).getTime();
  const diff = Math.floor((now - ts) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}days ago`;

  const d = new Date(date);
  const currentYear = new Date().getFullYear();

  const options =
    d.getFullYear() === currentYear
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "short", year: "numeric" };

  return d.toLocaleDateString("en-GB", options);
}