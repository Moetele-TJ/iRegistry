// src/lib/invokeWithAuth.js
import { supabase } from "./supabase";
import { getAuthHeaders } from "./authHeaders";

export async function invokeWithAuth(name, options = {}) {
  return supabase.functions.invoke(name, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
}