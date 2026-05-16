// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
export const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = (() => {
  if (!supabaseConfigured) {
    console.error(
      "Supabase is not configured. Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY."
    );
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
})();
