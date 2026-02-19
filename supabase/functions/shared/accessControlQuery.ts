// 📁 supabase/functions/shared/accessControlQuery.ts

import { getPoliceStation } from "./getPoliceStation.ts";
import { isPrivilegedRole } from "./roles.ts";

export async function applyItemAccessControl(
  supabase: any,
  query: any,
  session: any
) {
  /* ================= SAFETY CHECK ================= */

  // If query builder is somehow undefined, return early
  if (!query) return query;

  try {
    /* ================= PUBLIC ================= */

    if (!session || !session.role) {
      return query
        .not("reportedstolenat", "is", null)
        .is("deletedat", null);
    }

    const role = session.role;
    const userId = session.user_id;

    /* ================= USER ================= */

    if (role === "user") {
      return query
        .eq("ownerid", userId)
        .is("deletedat", null);
    }

    /* ================= POLICE ================= */

    if (role === "police") {
      const station = await getPoliceStation(supabase, userId);

      if (!station) {
        // Return empty safe result instead of throwing
        return query.eq("id", "__NO_MATCH__");
      }

      return query
        .not("reportedstolenat", "is", null)
        .eq("location", station)
        .is("deletedat", null);
    }

    /* ================= PRIVILEGED ================= */

    if (isPrivilegedRole(role)) {
      return query;
    }

    /* ================= UNKNOWN ROLE ================= */

    return query.eq("id", "__NO_MATCH__");

  } catch (err) {
    console.error("ACCESS CONTROL ERROR:", err);

    // Always return a valid query builder even on error
    return query.eq("id", "__NO_MATCH__");
  }
}