// src/utils/auth.js
import { supabase } from "../lib/supabase";

export async function validateSession() {
  const token = localStorage.getItem("session");

  if (!token) return null;

  const { data, error } = await supabase.functions.invoke("session-validate", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error || !data?.success) {
    localStorage.removeItem("session");
    return null;
  }

  return data; // { role, id_number }
}