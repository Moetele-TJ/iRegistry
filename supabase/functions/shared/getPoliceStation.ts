// supabase/functions/shared/getPoliceStation.ts
export async function getPoliceStation(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("police_station")
    .eq("id", userId)
    .single();

  if (error || !data?.police_station) return null;
  return data.police_station;
}