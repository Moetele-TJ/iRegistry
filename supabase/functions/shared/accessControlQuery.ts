//  📁 supabase/functions/shared/accessControlQuery.ts

import { getPoliceStation } from "./getPoliceStation.ts";
import { isPrivilegedRole } from "./roles.ts";

export async function applyItemAccessControl(
  supabase: any,
  query: any,
  session: any
) {
  /* ================= SAFETY CHECK ================= */
  if (!query || typeof query.eq !== "function") {
    console.error("Invalid base query passed to access control");
    return query;
  }

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
    return query.eq("id", "__NO_MATCH__");
  }
}