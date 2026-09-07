import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useUserSidebar } from "../../hooks/useUserSidebar.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function photoSrc(p) {
  if (!p) return null;
  if (typeof p === "string") {
    if (p.startsWith("http")) return p;
    return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${p}`;
  }
  const path = p.thumb || p.original || p.path;
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${path}`;
}

function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export default function UserLivestockSightingsPage() {
  useUserSidebar({ visible: true });
  const { addToast } = useToast();
  const [sightings, setSightings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-list-sightings" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load sightings");
      }
      setSightings(Array.isArray(data.sightings) ? data.sightings : []);
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to load sightings" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id, decision) {
    setBusyId(id);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-decide-sighting", id, decision },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not update sighting");
      }
      addToast({
        type: "success",
        message: decision === "accepted" ? "Sighting accepted." : "Sighting rejected.",
      });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Update failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function reveal(id) {
    setBusyId(id);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-reveal-sighting", id },
      });
      if (error || !data?.success) {
        throw new Error(
          data?.message || error?.message || "Could not reveal location (2 credits required)",
        );
      }
      if (data.location) {
        addToast({ type: "success", message: "Location unlocked." });
      }
      await load();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Reveal failed" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <Link to="/user/livestock" className="text-sm text-iregistrygreen hover:underline">
          ← Livestock
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">Livestock sightings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Accept or reject reports. After accept, reveal the exact pin for 2 credits when GPS was
          captured.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : sightings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          No sightings yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {sightings.map((s) => {
            const a = s.animal;
            const thumb = photoSrc(a?.photos?.[0]);
            const label = a?.name || a?.breed || a?.type_code || "Animal";
            const busy = busyId === s.id;
            const distance =
              s.distance_band != null
                ? `some ${s.distance_band} away`
                : "distance unknown";

            return (
              <li
                key={s.id}
                className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col sm:flex-row gap-3"
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <Link
                      to={`/user/livestock/${s.animal_id}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {label}
                    </Link>
                    <span className="text-xs text-gray-500 capitalize">{s.source}</span>
                    <span className="text-xs text-gray-500">· {distance}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : ""}
                    {" · "}
                    Decision:{" "}
                    <span className="font-medium capitalize">{s.owner_decision}</span>
                  </div>

                  {s.owner_decision === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <RippleButton
                        type="button"
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl bg-iregistrygreen text-white text-sm disabled:opacity-60"
                        onClick={() => void decide(s.id, "accepted")}
                      >
                        Accept
                      </RippleButton>
                      <RippleButton
                        type="button"
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl border text-sm disabled:opacity-60"
                        onClick={() => void decide(s.id, "rejected")}
                      >
                        Reject
                      </RippleButton>
                    </div>
                  ) : null}

                  {s.owner_decision === "accepted" ? (
                    <div className="space-y-2">
                      {s.location?.lat != null && s.location?.lng != null ? (
                        <a
                          href={mapsUrl(s.location.lat, s.location.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-sm font-semibold text-iregistrygreen hover:underline"
                        >
                          Open map pin ({Number(s.location.lat).toFixed(5)},{" "}
                          {Number(s.location.lng).toFixed(5)})
                        </a>
                      ) : s.has_coords ? (
                        <RippleButton
                          type="button"
                          disabled={busy}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-sm disabled:opacity-60"
                          onClick={() => void reveal(s.id)}
                        >
                          Reveal location — 2 credits
                        </RippleButton>
                      ) : (
                        <div className="text-xs text-gray-500">
                          No GPS was captured for this sighting.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
