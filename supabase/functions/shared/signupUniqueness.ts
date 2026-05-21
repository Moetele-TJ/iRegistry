import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  findBlockingSignupUser,
  normalizeSignupEmail,
  normalizeSignupIdNumber,
  signupConflictMessage,
} from "./userState.ts";

export type SignupIdentifiers = {
  id_number: string;
  email: string;
  phone: string;
};

/** Returns a user-facing error message, or null if identifiers are free for signup. */
export async function findSignupIdentifierConflict(
  supabase: SupabaseClient,
  ids: SignupIdentifiers,
): Promise<string | null> {
  const idNorm = normalizeSignupIdNumber(ids.id_number);
  const { data: idRows } = await supabase
    .from("users")
    .select("id, deleted_at, disabled_at, suspended_at")
    .eq("id_number", idNorm);
  const idConflict = findBlockingSignupUser(idRows);
  if (idConflict) {
    return signupConflictMessage("id_number", idConflict.status);
  }

  const phone = ids.phone.trim();
  const { data: phoneRows } = await supabase
    .from("users")
    .select("id, deleted_at, disabled_at, suspended_at")
    .eq("phone", phone);
  const phoneConflict = findBlockingSignupUser(phoneRows);
  if (phoneConflict) {
    return signupConflictMessage("phone", phoneConflict.status);
  }

  const emailNorm = normalizeSignupEmail(ids.email);
  const emailVariants = [...new Set([emailNorm, ids.email.trim()].filter(Boolean))];
  const { data: emailRows } = await supabase
    .from("users")
    .select("id, deleted_at, disabled_at, suspended_at, email")
    .in("email", emailVariants);
  const emailConflict = findBlockingSignupUser(emailRows);
  if (emailConflict) {
    return signupConflictMessage("email", emailConflict.status);
  }

  return null;
}

/** Map Postgres unique_violation to a friendly signup message when possible. */
export function mapSignupInsertError(message: string): string {
  const m = String(message || "");
  if (m.includes("users_phone_active_key") || m.includes("users_phone_key")) {
    return signupConflictMessage("phone", "active");
  }
  if (m.includes("users_email_active_key") || m.includes("users_email_key")) {
    return signupConflictMessage("email", "active");
  }
  if (m.includes("users_id_number_active_key") || m.includes("users_id_number_key")) {
    return signupConflictMessage("id_number", "active");
  }
  if (m.includes("duplicate key value violates unique constraint")) {
    return "An account with these details already exists.";
  }
  return m || "Failed to create account";
}
