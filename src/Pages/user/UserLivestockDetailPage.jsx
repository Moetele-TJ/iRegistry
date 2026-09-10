import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { livestockPhotoSrc } from "../../lib/livestockPhotos.js";
import BrandOrientationField, {
  BrandMarkPreview,
} from "../../components/BrandOrientationField.jsx";
import { isPrivilegedRole } from "../../lib/billingUx.js";
import { roleIs } from "../../lib/roleUtils.js";
import { displayUser } from "../../lib/userDisplay.js";
import { staffProfilePath } from "../../lib/userProfilePath.js";
import { NAV } from "../../lib/navLabels.js";

const FIELD_CLASS = "mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white";
const EMPTY_BRAND = {
  characters: "",
  layout: "horizontal",
  side: "left",
  body_part: "shoulder",
};

function listBackPath(role) {
  if (roleIs(role, "admin")) return "/admin/livestock";
  if (roleIs(role, "cashier")) return "/cashier/livestock";
  if (roleIs(role, "police")) return "/police/livestock";
  return "/user/livestock";
}

function statusBadgeClass(status) {
  switch (String(status || "").toLowerCase()) {
    case "missing":
      return "bg-red-50 text-red-700 border-red-100";
    case "recovered":
      return "bg-sky-50 text-sky-800 border-sky-100";
    case "deleted":
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-100";
  }
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm text-gray-900 break-words">{children}</div>
    </div>
  );
}

function PanelHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      {action || null}
    </div>
  );
}

function PlusButton({ onClick, label, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-iregistrygreen text-lg font-semibold leading-none hover:bg-emerald-100 disabled:opacity-40 disabled:pointer-events-none"
    >
      +
    </button>
  );
}

export default function UserLivestockDetailPage() {
  const { animalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [animal, setAnimal] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    breed: "",
    colour: "",
    gender: "unknown",
    zone_brand: "",
    dwelling_village: "",
  });

  const [addingBrand, setAddingBrand] = useState(false);
  const [brandDraft, setBrandDraft] = useState(EMPTY_BRAND);
  const [brandBusy, setBrandBusy] = useState(false);

  const [addingEarTag, setAddingEarTag] = useState(false);
  const [earTagDraft, setEarTagDraft] = useState({ tag_id: "", side: "left" });
  const [earTagBusy, setEarTagBusy] = useState(false);

  const backPath = listBackPath(user?.role);
  const canMutate =
    Boolean(animal) &&
    !Boolean(animal?.deleted_at) &&
    String(animal?.status || "").toLowerCase() !== "deleted" &&
    (String(animal.owner_id) === String(user?.id) || isPrivilegedRole(user?.role));
  const isOwner =
    Boolean(animal?.owner_id) &&
    Boolean(user?.id) &&
    String(animal.owner_id) === String(user.id);
  const showOwnerDetails = Boolean(animal && !isOwner);
  const brandBearing = Boolean(animal?.brand_bearing);
  const brands = Array.isArray(animal?.brands) ? animal.brands : [];
  const earTags = Array.isArray(animal?.ear_tags) ? animal.ear_tags : [];
  const earMarks = Array.isArray(animal?.ear_marks) ? animal.ear_marks : [];

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
      setOwner(data.owner || null);
      setActivePhoto(0);
      setAddingBrand(false);
      setAddingEarTag(false);
      setEditing(false);
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to load animal" });
      setAnimal(null);
      setOwner(null);
    } finally {
      setLoading(false);
    }
  }, [addToast, animalId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit() {
    if (!animal) return;
    setEditForm({
      name: animal.name || "",
      breed: animal.breed || "",
      colour: animal.colour || "",
      gender: animal.gender || "unknown",
      zone_brand: animal.zone_brand || "",
      dwelling_village: animal.dwelling_village || "",
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!animal || !canMutate) return;
    setEditBusy(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: {
          operation: "livestock-update-mine",
          id: animal.id,
          name: editForm.name,
          breed: editForm.breed,
          colour: editForm.colour,
          gender: editForm.gender,
          zone_brand: editForm.zone_brand,
          dwelling_village: editForm.dwelling_village,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not save changes");
      }
      setAnimal((a) => ({
        ...a,
        ...data.animal,
        signed_photos: a?.signed_photos,
        brand_bearing: a?.brand_bearing,
        type_label: a?.type_label,
        brands: data.animal?.brands ?? a?.brands,
        ear_tags: data.animal?.ear_tags ?? a?.ear_tags,
        ear_marks: data.animal?.ear_marks ?? a?.ear_marks,
      }));
      setEditing(false);
      addToast({ type: "success", message: "Details updated." });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Update failed" });
    } finally {
      setEditBusy(false);
    }
  }

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
        deleted: "Moved to recycle bin.",
      };
      addToast({ type: "success", message: messages[status] || "Status updated." });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Update failed" });
    } finally {
      setStatusBusy(false);
    }
  }

  async function saveBrand() {
    if (!animal || !canMutate) return;
    if (!String(brandDraft.characters || "").trim()) {
      addToast({ type: "error", message: "Enter brand characters." });
      return;
    }
    setBrandBusy(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: {
          operation: "livestock-add-brand",
          id: animal.id,
          characters: brandDraft.characters,
          layout: brandDraft.layout,
          side: brandDraft.side,
          body_part: brandDraft.body_part,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not add brand");
      }
      setAnimal((a) => ({
        ...a,
        brands: data.animal?.brands || [],
      }));
      setBrandDraft(EMPTY_BRAND);
      setAddingBrand(false);
      addToast({ type: "success", message: "Brand added." });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Could not add brand" });
    } finally {
      setBrandBusy(false);
    }
  }

  async function saveEarTag() {
    if (!animal || !canMutate) return;
    if (!String(earTagDraft.tag_id || "").trim()) {
      addToast({ type: "error", message: "Enter a tag ID." });
      return;
    }
    setEarTagBusy(true);
    try {
      const { data, error } = await invokeWithAuth("livestock-api", {
        body: {
          operation: "livestock-add-ear-tag",
          id: animal.id,
          tag_id: earTagDraft.tag_id,
          side: earTagDraft.side,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not add ear tag");
      }
      setAnimal((a) => ({
        ...a,
        ear_tags: data.animal?.ear_tags || [],
      }));
      setEarTagDraft({ tag_id: "", side: "left" });
      setAddingEarTag(false);
      addToast({ type: "success", message: "Ear tag added." });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Could not add ear tag" });
    } finally {
      setEarTagBusy(false);
    }
  }

  const photoSrcs = useMemo(() => {
    if (!animal) return [];
    const signed = Array.isArray(animal.signed_photos)
      ? animal.signed_photos.map((p) => p?.url).filter(Boolean)
      : [];
    if (signed.length) return signed;
    const photos = Array.isArray(animal.photos) ? animal.photos : [];
    return photos.map((p) => livestockPhotoSrc(p, false)).filter(Boolean);
  }, [animal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden p-8 flex items-center gap-3 text-sm text-emerald-900">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent shrink-0" />
            Loading animal…
          </div>
        </div>
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 text-center">
            <h2 className="text-lg font-semibold">Animal not found</h2>
            <p className="text-sm text-gray-500 mt-2">
              The requested animal does not exist or you do not have access to it.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <RippleButton
                className="px-4 py-2 rounded-xl border bg-white text-sm"
                onClick={() => navigate(backPath)}
              >
                Back to livestock
              </RippleButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = String(animal.status || "active").toLowerCase();
  const isDeleted = status === "deleted" || Boolean(animal.deleted_at);
  const isMissing = status === "missing";
  const isRecovered = status === "recovered";
  const mainSrc = photoSrcs[Math.min(activePhoto, Math.max(0, photoSrcs.length - 1))] || null;
  const title = animal.name || animal.breed || animal.type_code || "Animal";
  const ownerLabel = displayUser(owner) || owner?.email || owner?.id_number || "Owner";
  const ownerProfileHref =
    isPrivilegedRole(user?.role) && owner
      ? staffProfilePath(
          roleIs(user?.role, "admin") ? "/admin" : roleIs(user?.role, "cashier") ? "/cashier" : "/police",
          owner,
        )
      : null;
  const canAddBrand = canMutate && brandBearing && brands.length < 4;
  const canAddEarTag = canMutate && earTags.length < 2;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-emerald-100/70 bg-gradient-to-r from-emerald-50/95 via-emerald-50/50 to-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-iregistrygreen truncate">
                    {title}
                  </h1>
                  {isDeleted ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border bg-gray-50 text-gray-700 border-gray-200">
                      Deleted
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border capitalize ${statusBadgeClass(status)}`}
                  >
                    {status}
                  </span>
                  {animal.type_code ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border bg-gray-50 text-gray-700 border-gray-100">
                      {animal.type_label || animal.type_code}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {[animal.breed, animal.colour, animal.gender].filter(Boolean).join(" · ") || "—"}
                  {animal.dwelling_village ? (
                    <>
                      <span className="mx-2 text-gray-300">|</span>
                      {animal.dwelling_village}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <RippleButton
                  className="px-4 py-2 rounded-xl border bg-white text-sm"
                  onClick={() => navigate(backPath)}
                >
                  Back
                </RippleButton>

                {canMutate && !isDeleted ? (
                  editing ? (
                    <>
                      <RippleButton
                        className="px-4 py-2 rounded-xl border bg-white text-sm"
                        onClick={() => setEditing(false)}
                        disabled={editBusy}
                      >
                        Cancel
                      </RippleButton>
                      <RippleButton
                        className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold shadow-sm disabled:opacity-60"
                        onClick={() => void saveEdit()}
                        disabled={editBusy}
                      >
                        {editBusy ? "Saving…" : "Save"}
                      </RippleButton>
                    </>
                  ) : (
                    <RippleButton
                      className="px-4 py-2 rounded-xl border border-emerald-200 bg-white text-sm font-medium text-emerald-800"
                      onClick={startEdit}
                    >
                      Edit
                    </RippleButton>
                  )
                ) : null}

                {roleIs(user?.role, "user") ? (
                  <Link
                    to="/user/livestock/sightings"
                    className="inline-flex items-center px-4 py-2 rounded-xl border border-emerald-200/80 bg-white text-sm font-medium text-gray-700"
                  >
                    {NAV.livestockSightings}
                  </Link>
                ) : null}

                {canMutate && isDeleted ? (
                  <RippleButton
                    className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60"
                    onClick={() => void setStatus("active")}
                    disabled={statusBusy}
                  >
                    {statusBusy ? "Restoring…" : "Restore"}
                  </RippleButton>
                ) : null}

                {canMutate && !isDeleted ? (
                  <>
                    {isMissing ? (
                      <>
                        <RippleButton
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm disabled:opacity-60"
                          onClick={() => void setStatus("recovered")}
                          disabled={statusBusy}
                        >
                          Mark recovered
                        </RippleButton>
                        <RippleButton
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60"
                          onClick={() => void setStatus("active")}
                          disabled={statusBusy}
                        >
                          Mark active
                        </RippleButton>
                      </>
                    ) : isRecovered ? (
                      <RippleButton
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60"
                        onClick={() => void setStatus("active")}
                        disabled={statusBusy}
                      >
                        Mark active
                      </RippleButton>
                    ) : (
                      <RippleButton
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60"
                        onClick={() => void setStatus("missing")}
                        disabled={statusBusy}
                      >
                        Mark missing
                      </RippleButton>
                    )}

                    <RippleButton
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm disabled:opacity-60"
                      onClick={() => void setStatus("deleted")}
                      disabled={statusBusy}
                    >
                      Recycle bin
                    </RippleButton>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {isDeleted &&
            (String(animal.owner_id) === String(user?.id) || isPrivilegedRole(user?.role)) ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <div className="font-semibold">In your recycle bin</div>
                <p className="mt-1 text-amber-900/90">
                  You can restore this animal to active from the header actions.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-3xl border border-gray-100/90 bg-white shadow-md shadow-slate-200/70 p-4">
                  <PanelHeader title="Photos" />
                  <div className="relative w-full aspect-square rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
                    {mainSrc ? (
                      <img src={mainSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
                        No photos
                      </div>
                    )}
                  </div>
                  {photoSrcs.length > 1 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {photoSrcs.map((src, i) => (
                        <button
                          key={src + i}
                          type="button"
                          onClick={() => setActivePhoto(i)}
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 ${
                            i === activePhoto
                              ? "border-iregistrygreen"
                              : "border-gray-200"
                          }`}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                {showOwnerDetails ? (
                  <div className="rounded-3xl border border-amber-100 bg-amber-50/70 shadow-md shadow-amber-100/80 p-5">
                    <PanelHeader title="Owner" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Fact label="Name">
                        {ownerProfileHref ? (
                          <Link
                            to={ownerProfileHref}
                            className="text-iregistrygreen font-semibold hover:underline"
                          >
                            {ownerLabel}
                          </Link>
                        ) : (
                          ownerLabel
                        )}
                      </Fact>
                      {owner?.phone ? <Fact label="Phone">{owner.phone}</Fact> : null}
                      {owner?.email ? <Fact label="Email">{owner.email}</Fact> : null}
                      {owner?.id_number ? <Fact label="ID number">{owner.id_number}</Fact> : null}
                      {owner?.village || owner?.ward ? (
                        <Fact label="Location">
                          {[owner.village, owner.ward].filter(Boolean).join(" · ") || "—"}
                        </Fact>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-gray-100/90 bg-white shadow-md shadow-slate-200/70 p-5">
                  <PanelHeader title="Details" />
                  {editing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Name</label>
                        <input
                          className={FIELD_CLASS}
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Gender</label>
                        <select
                          className={FIELD_CLASS}
                          value={editForm.gender}
                          onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                        >
                          <option value="unknown">Unknown</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Breed</label>
                        <input
                          className={FIELD_CLASS}
                          value={editForm.breed}
                          onChange={(e) => setEditForm((f) => ({ ...f, breed: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Colour</label>
                        <input
                          className={FIELD_CLASS}
                          value={editForm.colour}
                          onChange={(e) => setEditForm((f) => ({ ...f, colour: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Dwelling / village</label>
                        <input
                          className={FIELD_CLASS}
                          value={editForm.dwelling_village}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, dwelling_village: e.target.value }))
                          }
                        />
                      </div>
                      {brandBearing ? (
                        <div>
                          <label className="text-xs text-gray-600">Zone brand</label>
                          <input
                            className={FIELD_CLASS}
                            value={editForm.zone_brand}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, zone_brand: e.target.value }))
                            }
                          />
                        </div>
                      ) : null}
                      <Fact label="Type">{animal.type_label || animal.type_code || "—"}</Fact>
                      <Fact label="Status">
                        <span className="capitalize">{status}</span>
                      </Fact>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Fact label="Name">{animal.name || "—"}</Fact>
                      <Fact label="Type">{animal.type_label || animal.type_code || "—"}</Fact>
                      <Fact label="Breed">{animal.breed || "—"}</Fact>
                      <Fact label="Colour">{animal.colour || "—"}</Fact>
                      <Fact label="Gender">{animal.gender || "—"}</Fact>
                      <Fact label="Status">
                        <span className="capitalize">{status}</span>
                      </Fact>
                      <Fact label="Dwelling">
                        {animal.dwelling_village || "—"}
                        {animal.dwelling_lat != null && animal.dwelling_lng != null ? (
                          <span className="text-gray-500 tabular-nums">
                            {" "}
                            ({Number(animal.dwelling_lat).toFixed(5)},{" "}
                            {Number(animal.dwelling_lng).toFixed(5)})
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            {" "}
                            — no coordinates (distance alerts limited)
                          </span>
                        )}
                      </Fact>
                      {animal.zone_brand ? (
                        <Fact label="Zone brand">{animal.zone_brand}</Fact>
                      ) : null}
                    </div>
                  )}
                </div>

                {brandBearing || brands.length ? (
                  <div className="rounded-3xl border border-gray-100/90 bg-white shadow-md shadow-slate-200/70 p-5">
                    <PanelHeader
                      title="Brands"
                      action={
                        canAddBrand && !addingBrand ? (
                          <PlusButton
                            label="Add brand"
                            onClick={() => {
                              setBrandDraft(EMPTY_BRAND);
                              setAddingBrand(true);
                            }}
                          />
                        ) : null
                      }
                    />
                    {brands.length ? (
                      <div className="flex flex-wrap gap-3">
                        {brands.map((b) => (
                          <BrandMarkPreview
                            key={b.id || `${b.characters}-${b.side}-${b.body_part}`}
                            layout={b.layout || "horizontal"}
                            characters={b.characters || ""}
                            side={b.side}
                            body_part={b.body_part}
                          />
                        ))}
                      </div>
                    ) : !addingBrand ? (
                      <p className="text-sm text-gray-500">No brands yet.</p>
                    ) : null}

                    {addingBrand ? (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
                        <BrandOrientationField
                          layout={brandDraft.layout}
                          characters={brandDraft.characters}
                          onLayoutChange={(layout) =>
                            setBrandDraft((d) => ({ ...d, layout }))
                          }
                          onCharactersChange={(characters) =>
                            setBrandDraft((d) => ({ ...d, characters }))
                          }
                          side={brandDraft.side}
                          bodyPart={brandDraft.body_part}
                          onSideChange={(side) => setBrandDraft((d) => ({ ...d, side }))}
                          onBodyPartChange={(body_part) =>
                            setBrandDraft((d) => ({ ...d, body_part }))
                          }
                        />
                        <div className="flex flex-wrap gap-2 justify-end">
                          <RippleButton
                            type="button"
                            className="px-3 py-1.5 rounded-xl border bg-white text-sm"
                            onClick={() => {
                              setAddingBrand(false);
                              setBrandDraft(EMPTY_BRAND);
                            }}
                            disabled={brandBusy}
                          >
                            Cancel
                          </RippleButton>
                          <RippleButton
                            type="button"
                            className="px-3 py-1.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                            onClick={() => void saveBrand()}
                            disabled={brandBusy}
                          >
                            {brandBusy ? "Saving…" : "Save brand"}
                          </RippleButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-gray-100/90 bg-white shadow-md shadow-slate-200/70 p-5">
                  <PanelHeader
                    title="Ear tags"
                    action={
                      canAddEarTag && !addingEarTag ? (
                        <PlusButton
                          label="Add ear tag"
                          onClick={() => {
                            setEarTagDraft({ tag_id: "", side: "left" });
                            setAddingEarTag(true);
                          }}
                        />
                      ) : null
                    }
                  />
                  {earTags.length ? (
                    <ul className="space-y-1 text-sm text-gray-800">
                      {earTags.map((t) => (
                        <li key={t.id || t.tag_id}>
                          {t.tag_id} ({t.side})
                        </li>
                      ))}
                    </ul>
                  ) : !addingEarTag ? (
                    <p className="text-sm text-gray-500">No ear tags yet.</p>
                  ) : null}

                  {addingEarTag ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
                      <div className="flex gap-2 items-center min-w-0">
                        <input
                          className="min-w-0 flex-1 border rounded-xl px-3 py-2 text-sm bg-white"
                          placeholder="Tag ID"
                          value={earTagDraft.tag_id}
                          onChange={(e) =>
                            setEarTagDraft((d) => ({ ...d, tag_id: e.target.value }))
                          }
                        />
                        <select
                          className="w-[5.5rem] shrink-0 border rounded-xl px-2 py-2 text-sm bg-white"
                          value={earTagDraft.side}
                          onChange={(e) =>
                            setEarTagDraft((d) => ({ ...d, side: e.target.value }))
                          }
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <RippleButton
                          type="button"
                          className="px-3 py-1.5 rounded-xl border bg-white text-sm"
                          onClick={() => {
                            setAddingEarTag(false);
                            setEarTagDraft({ tag_id: "", side: "left" });
                          }}
                          disabled={earTagBusy}
                        >
                          Cancel
                        </RippleButton>
                        <RippleButton
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                          onClick={() => void saveEarTag()}
                          disabled={earTagBusy}
                        >
                          {earTagBusy ? "Saving…" : "Save tag"}
                        </RippleButton>
                      </div>
                    </div>
                  ) : null}
                </div>

                {earMarks.length ? (
                  <div className="rounded-3xl border border-gray-100/90 bg-white shadow-md shadow-slate-200/70 p-5">
                    <PanelHeader title="Ear marks" />
                    <ul className="space-y-1 text-sm text-gray-800">
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
          </div>
        </div>
      </div>
    </div>
  );
}
