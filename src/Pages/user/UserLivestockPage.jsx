import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useUserSidebar } from "../../hooks/useUserSidebar.jsx";
import { NAV } from "../../lib/navLabels.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function thumb(p) {
  if (!p) return null;
  const path = typeof p === "string" ? p : p.thumb || p.original;
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${path}`;
}

export default function UserLivestockPage() {
  useUserSidebar({ visible: true });
  const { addToast } = useToast();
  const [animals, setAnimals] = useState([]);
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, packRes] = await Promise.all([
        invokeWithAuth("livestock-api", { body: { operation: "livestock-list-mine" } }),
        invokeWithAuth("livestock-api", { body: { operation: "livestock-get-pack-status" } }),
      ]);
      if (listRes.error || !listRes.data?.success) {
        throw new Error(listRes.data?.message || listRes.error?.message || "Failed to load");
      }
      setAnimals(Array.isArray(listRes.data.animals) ? listRes.data.animals : []);
      if (packRes.data?.success) {
        setPack({
          ...packRes.data.pack,
          can_register: packRes.data.can_register,
          needs_pack: packRes.data.needs_pack,
        });
      }
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to load livestock" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function buyPack() {
    const { data, error } = await invokeWithAuth("livestock-api", {
      body: { operation: "livestock-buy-pack" },
    });
    if (error || !data?.success) {
      addToast({
        type: "error",
        message: data?.message || error?.message || "Could not buy pack",
      });
      return;
    }
    addToast({ type: "success", message: "Registration pack unlocked (10 animals)." });
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{NAV.livestock || "Livestock"}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Register animals with photos. Public sightings notify you with distance from home.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/user/livestock/sightings"
            className="px-4 py-2 rounded-xl border bg-white text-sm font-medium text-gray-800"
          >
            Sightings
          </Link>
          <Link
            to="/user/livestock/register"
            className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold"
          >
            Register animal
          </Link>
        </div>
      </div>

      {pack ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-700 flex flex-wrap items-center justify-between gap-2">
          <div>
            Registered: <span className="font-semibold tabular-nums">{pack.lifetime_registered ?? 0}</span>
            {" · "}
            Pack slots left:{" "}
            <span className="font-semibold tabular-nums">{pack.pack_slots_remaining ?? 0}</span>
            {pack.lifetime_registered < 2 ? (
              <span className="text-gray-500"> (first 2 free)</span>
            ) : null}
          </div>
          {pack.needs_pack ? (
            <RippleButton
              type="button"
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-sm"
              onClick={() => void buyPack()}
            >
              Buy pack — 5 credits / 10 animals
            </RippleButton>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : animals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          No animals yet.{" "}
          <Link to="/user/livestock/register" className="text-iregistrygreen font-semibold underline">
            Register your first animal
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {animals.map((a) => {
            const src = thumb(a.photos?.[0]);
            return (
              <Link
                key={a.id}
                to={`/user/livestock/${a.id}`}
                className="rounded-2xl border border-gray-100 bg-white overflow-hidden hover:border-emerald-200 transition"
              >
                <div className="aspect-[4/3] bg-gray-100">
                  {src ? (
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      No photo
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-gray-900">
                    {a.name || a.breed || a.type_code || "Animal"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[a.type_code, a.colour, a.breed].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
