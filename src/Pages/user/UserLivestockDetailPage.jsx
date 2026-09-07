import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { livestockPhotoSrc } from "../../lib/livestockPhotos.js";
import { isPrivilegedRole } from "../../lib/billingUx.js";
import { roleIs } from "../../lib/roleUtils.js";
import { NAV } from "../../lib/navLabels.js";

function listBackPath(role) {
  if (roleIs(role, "admin")) return "/admin/livestock";
  if (roleIs(role, "cashier")) return "/cashier/livestock";
  if (roleIs(role, "police")) return "/police/livestock";
  return "/user/livestock";
}

export default function UserLivestockDetailPage() {
  const { animalId } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [animal, setAnimal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);

  const backPath = listBackPath(user?.role);
  const canMutate =
    Boolean(animal) &&
    (String(animal.owner_id) === String(user?.id) || isPrivilegedRole(user?.role));

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

  async function setStatus(status) {
    if (!animal || !canMutate) return;
    if (animal.status === status && status !== "deleted") return;
    setStatusBusy(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-set-status", id: animal.id, status },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not update status");
      }
      setAnimal((a) =>
        a
          ? {
              ...a,
              status: data.animal?.status || status,
              deleted_at: data.animal?.deleted_at ?? a.deleted_at,
            }
          : a,
      );
      const messages = {
        active: "Marked as active.",
        missing: "Marked as missing.",
        recovered: "Marked as recovered.",
        deleted: "Animal moved to deleted.",
      };
      addToast({ type: "success", message: messages[status] || "Status updated." });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Update failed" });
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 text-sm text-gray-500">Loading…</div>
    );
  }

  if (!animal) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-2">
        <Link to={backPath} className="text-sm text-iregistrygreen hover:underline">
          ← {NAV.livestock}
        </Link>
        <p className="text-sm text-gray-600">Animal not found.</p>
      </div>
    );
  }

  const photos = Array.isArray(animal.photos) ? animal.photos : [];
  const brands = Array.isArray(animal.brands) ? animal.brands : [];
  const earTags = Array.isArray(animal.ear_tags) ? animal.ear_tags : [];
  const earMarks = Array.isArray(animal.ear_marks) ? animal.ear_marks : [];
  const status = String(animal.status || "active").toLowerCase();
  const isDeleted = status === "deleted" || Boolean(animal.deleted_at);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={backPath} className="text-sm text-iregistrygreen hover:underline">
            ← {NAV.livestock}
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
        {roleIs(user?.role, "user") ? (
          <Link
            to="/user/livestock/sightings"
            className="px-4 py-2 rounded-xl border bg-white text-sm font-medium"
          >
            {NAV.livestockSightings}
          </Link>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            Status:{" "}
            <span className="font-semibold capitalize text-gray-900">{status}</span>
          </div>
          {canMutate && !isDeleted ? (
            <div className="inline-flex flex-wrap rounded-xl border border-gray-200 p-1 bg-gray-50 gap-0.5">
              {["active", "missing", "recovered"].map((s) => (
                <RippleButton
                  key={s}
                  type="button"
                  disabled={statusBusy || status === s}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg capitalize ${
                    status === s ? "bg-white text-iregistrygreen shadow-sm" : "text-gray-600"
                  } disabled:opacity-60`}
                  onClick={() => void setStatus(s)}
                >
                  {s}
                </RippleButton>
              ))}
            </div>
          ) : null}
        </div>
        {canMutate ? (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            {isDeleted ? (
              <RippleButton
                type="button"
                disabled={statusBusy}
                className="px-3 py-1.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                onClick={() => void setStatus("active")}
              >
                Restore to active
              </RippleButton>
            ) : (
              <RippleButton
                type="button"
                disabled={statusBusy}
                className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-60"
                onClick={() => void setStatus("deleted")}
              >
                Move to deleted
              </RippleButton>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map((p, i) => {
          const src = livestockPhotoSrc(p);
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
