// src/lib/invokeWithAuth.js
import { supabase } from "./supabase";
import { getAuthHeaders } from "./authHeaders";

export async function invokeWithAuth(name, options = {}) {

  const response = await supabase.functions.invoke(name, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const { data, error } = response;

  /* SESSION EXPIRED */
  if (error?.context?.status === 401) {

    // Clear stored session token
    localStorage.removeItem("session");

    // Force redirect to login
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }

    return { data: null, error };
  }

  return response;
}