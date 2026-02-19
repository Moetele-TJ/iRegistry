//  📁 supabase/functions/shared/accessConditions.ts

import { getPoliceStation } from "./getPoliceStation.ts";
import { isPrivilegedRole } from "./roles.ts";

export async function getAccessConditions(
  supabase: any,
  session: any
) {
  /* ================= PUBLIC ================= */

  if (!session || !session.role) {
    return {
      reportedstolenat: "NOT_NULL",
      deletedat: null,
    };
  }

  const role = session.role;
  const userId = session.user_id;

  /* ================= USER ================= */

  if (role === "user") {
    return {
      ownerid: userId,
      deletedat: null,
    };
  }

  /* ================= POLICE ================= */

  if (role === "police") {
    const station = await getPoliceStation(supabase, userId);

    if (!station) {
      return {
        forceEmpty: true,
      };
    }

    return {
      reportedstolenat: "NOT_NULL",
      location: station,
      deletedat: null,
    };
  }

  /* ================= PRIVILEGED ================= */

  if (isPrivilegedRole(role)) {
    return {};
  }

  /* ================= UNKNOWN ================= */

  return {
    forceEmpty: true,
  };
}