import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  const path = p.thumb || p.original || p.path || p.url;
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${path}`;
}

export default function UserLivestockDetailPage() {
  useUserSidebar({ visible: true });
  const { animalId } = useParams();
  const { addToast } = useToast();
  const [animal, setAnimal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-get-mine", id: animalId },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load");
      }
      setAnimal(data.animal);
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to load animal" });
      setAnimal(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, animalId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 text-sm text-gray-500">Loading…</div>
    );
  }

  if (!animal) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-2">
        <Link to="/user/livestock" className="text-sm text-iregistrygreen hover:underline">
          ← Livestock
        </Link>
        <p className="text-sm text-gray-600">Animal not found.</p>
      </div>
    );
  }

  const photos = Array.isArray(animal.photos) ? animal.photos : [];
  const brands = Array.isArray(animal.brands) ? animal.brands : [];
  const earTags = Array.isArray(animal.ear_tags) ? animal.ear_tags : [];
  const earMarks = Array.isArray(animal.ear_marks) ? animal.ear_marks : [];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/user/livestock" className="text-sm text-iregistrygreen hover:underline">
            ← Livestock
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">
            {animal.name || animal.breed || animal.type_code || "Animal"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {[animal.type_code, animal.gender, animal.colour, animal.breed]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link
          to="/user/livestock/sightings"
          className="px-4 py-2 rounded-xl border bg-white text-sm font-medium"
        >
          Sightings
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p, i) => {
          const src = photoSrc(p);
          return src ? (
            <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null;
        })}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 text-sm">
        <div>
          <div className="text-xs text-gray-500">Dwelling</div>
          <div className="text-gray-800">
            {animal.dwelling_village || "—"}
            {animal.dwelling_lat != null && animal.dwelling_lng != null ? (
              <span className="text-gray-500 tabular-nums">
                {" "}
                ({Number(animal.dwelling_lat).toFixed(5)}, {Number(animal.dwelling_lng).toFixed(5)})
              </span>
            ) : (
              <span className="text-amber-700"> — no coordinates (distance alerts limited)</span>
            )}
          </div>
        </div>

        {animal.zone_brand ? (
          <div>
            <div className="text-xs text-gray-500">Zone brand</div>
            <div className="font-medium">{animal.zone_brand}</div>
          </div>
        ) : null}

        {brands.length ? (
          <div>
            <div className="text-xs text-gray-500 mb-1">Brands</div>
            <ul className="space-y-1">
              {brands.map((b) => (
                <li key={b.id || `${b.characters}-${b.side}-${b.body_part}`}>
                  <span className="font-semibold tracking-wide">{b.characters}</span>
                  {" · "}
                  {b.layout} · {b.side} {b.body_part}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {earTags.length ? (
          <div>
            <div className="text-xs text-gray-500 mb-1">Ear tags</div>
            <ul className="space-y-1">
              {earTags.map((t) => (
                <li key={t.id || t.tag_id}>
                  {t.tag_id} ({t.side})
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {earMarks.length ? (
          <div>
            <div className="text-xs text-gray-500 mb-1">Ear marks</div>
            <ul className="space-y-1">
              {earMarks.map((m) => (
                <li key={m.id || m.mark_label}>
                  {m.mark_label}
                  {m.side ? ` (${m.side})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
