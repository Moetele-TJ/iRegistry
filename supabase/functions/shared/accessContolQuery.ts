// supabase/functions/shared/accessControlQuery.ts
import { getPoliceStation } from "./getPoliceStation.ts";
import { isPrivilegedRole } from "./roles.ts";

export async function applyItemAccessControl(
  supabase: any,
  query: any,
  session: any
) {
  // 🌍 PUBLIC MODE
  if (!session) {
    return query
      .not("reportedstolenat", "is", null)
      .is("deletedat", null);
  }

  // 👤 NORMAL USER → only own items
  if (session.role === "user") {
    return query.eq("ownerid", session.user_id);
  }

  // 🚔 POLICE → stolen items in their station
  if (session.role === "police") {
    const station = await getPoliceStation(supabase, session.user_id);

    if (!station) {
      throw new Error("Police station not configured");
    }

    return query
      .not("reportedstolenat", "is", null)
      .eq("location", station);
  }

  // 👑 PRIVILEGED ROLES (admin, cashier, etc.)
  if (isPrivilegedRole(session.role)) {
    return query;
  }

  // ❌ Everything else blocked
  throw new Error("Insufficient privileges");
}