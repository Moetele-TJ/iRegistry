// src/lib/authHeaders.js
export function getAuthHeaders() {
  const token = localStorage.getItem("session");

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}