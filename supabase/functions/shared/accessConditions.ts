//  📁 supabase/functions/shared/accessConditions.ts

import { getPoliceStation } from "./getPoliceStation.ts";
import { isPrivilegedRole } from "./roles.ts";

export async function getAccessConditions(
  supabase: any,
  session: any,
  opts?: { policeStationStolenView?: boolean },
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
    // Default: same as a normal user — their own registered items.
    if (!opts?.policeStationStolenView) {
      return {
        ownerid: userId,
        deletedat: null,
      };
    }

    // Stolen queue: open item_police_cases whose station matches this officer's profile.
    const station = await getPoliceStation(supabase, userId);

    if (!station) {
      return {
        forceEmpty: true,
      };
    }

    return {
      policeCaseQueue: true,
      policeStation: String(station).trim(),
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