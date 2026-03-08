// src/utils/alertIcon.js

export function getAlertIcon(message = "") {
  const text = message.toLowerCase();

  if (text.includes("verify")) return "🔍";
  if (text.includes("transfer")) return "📦";
  if (text.includes("stolen")) return "🚨";
  if (text.includes("location")) return "📍";
  if (text.includes("owner")) return "👤";

  return "🔔";
}