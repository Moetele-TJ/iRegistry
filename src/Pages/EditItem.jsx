// src/Pages/EditItem.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { useItems, normalizeItemFromDB } from "../contexts/ItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { formatBwpCurrency } from "../lib/formatBWP.js";
import { compressImage } from "../utils/imageCompression.js";
import { normalizePhotos } from "../utils/itemPhotos.js";
import BillingCostBanner from "../components/BillingCostBanner.jsx";
import BillingHelpLinks from "../components/BillingHelpLinks.jsx";
import PoliceStationSelect from "../components/PoliceStationSelect.jsx";
import CategoryMakeModelSelect from "../components/CategoryMakeModelSelect.jsx";
import {
  getEditItemPreviewCharges,
  isBalanceBelowMinimumForEdit,
  getMinimumCreditForAnyEditAction,
  formatInsufficientCreditsMessage,
  resolveOwnerBalanceForItem,
  willUpdateItemChargeOwnerWallet,
  isPrivilegedRole,
} from "../lib/billingUx.js";
import { isItemFrozen, isItemReportedStolen } from "../lib/itemState.js";
import { useTaskPricing } from "../hooks/useTaskPricing.js";
import { useBillingErrorMessage } from "../hooks/useBillingErrorMessage.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function toDateInputValue(v) {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function photoThumbUrl(entry) {
  if (!entry || !SUPABASE_URL) return null;

  const raw =
    typeof entry === "string"
      ? entry.trim()
      : (entry.thumb || entry.original || "").trim();

  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/item-photos/`;
  if (raw.startsWith(publicPrefix)) return raw;

  const relPrefix = "/storage/v1/object/public/item-photos/";
  if (raw.startsWith(relPrefix)) return `${SUPABASE_URL}${raw}`;

  const relPrefixNoSlash = "storage/v1/object/public/item-photos/";
  if (raw.startsWith(relPrefixNoSlash)) return `${SUPABASE_URL}/${raw}`;

  const normalizedPath = raw.replace(/^item-photos\//i, "").replace(/^\/+/, "");
  if (!normalizedPath) return null;

  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${normalizedPath}`;
}

export default function EditItem() {
  const { id, slug } = useParams();
  const routeParam = id ?? slug;
  const navigate = useNavigate();
  const { alert, confirm } = useModal();

  const {
    items,
    loading: itemsLoading,
    updateItem,
    deleteItem,
  } = useItems();
  const { user } = useAuth();
  const { getCost, loading: tasksLoading } = useTaskPricing();
  const formatBilling = useBillingErrorMessage();

  const [heldAtResidence, setHeldAtResidence] = useState(false);
  const [fetchedItem, setFetchedItem] = useState(null);
  const [lookupResolved, setLookupResolved] = useState(false);

  const itemFromList = useMemo(
    () =>
      (items || []).find(
        (it) =>
          String(it.id) === String(routeParam) || String(it.slug) === String(routeParam)
      ) || null,
    [items, routeParam]
  );

  const storedItem = itemFromList || fetchedItem;

  useEffect(() => {
    setFetchedItem(null);
    setLookupResolved(false);
  }, [routeParam]);

  useEffect(() => {
    if (itemsLoading) return;
    if (itemFromList) {
      setLookupResolved(true);
      setFetchedItem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await invokeWithAuth("get-items", {
        body: {
          itemLookup: routeParam,
          includeDeleted: true,
          includeLegacy: true,
          page: 1,
          pageSize: 1,
        },
      });
      if (cancelled) return;
      if (error || !data?.success || !data.items?.[0]) {
        setFetchedItem(null);
      } else {
        setFetchedItem(normalizeItemFromDB(data.items[0]));
      }
      setLookupResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeParam, itemsLoading, itemFromList]);

  const itemPageLoading = itemsLoading || (!itemFromList && !lookupResolved);

  const [form, setForm] = useState({
    category: "",
    make: "",
    model: "",
    serial1: "",
    serial2: "",
    village: "",
    ward: "",
    station: "",
    purchaseDate: "",
    estimatedValue: "",
    shop: "",
    warrantyExpiry: "",
    notes: "",
    status: "Active",
  });
  const [policeStation, setPoliceStation] = useState("");
  /** Raw digits while focused; formatted BWP when blurred */
  const [estimatedValueFocused, setEstimatedValueFocused] = useState(false);

  const [existingPhotos, setExistingPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [serialError, setSerialError] = useState(null);
  const [serialCheckWarning, setSerialCheckWarning] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);

  const activeXhrs = useRef([]);
  const uploadCancelledRef = useRef(false);
  const latestSerial1Ref = useRef("");
  latestSerial1Ref.current = form.serial1;

  const requiredFields = ["category", "make", "model", "serial1", "station"];

  const ownerRoleForBilling = storedItem?.ownerRole ?? null;
  const ownerBal = useMemo(
    () => (storedItem && user ? resolveOwnerBalanceForItem(storedItem, user) : 0),
    [storedItem, user]
  );
  const chargesOwnerWallet = useMemo(
    () =>
      willUpdateItemChargeOwnerWallet(user?.role, ownerRoleForBilling),
    [user?.role, ownerRoleForBilling]
  );

  const editPreviewCodes = useMemo(
    () =>
      getEditItemPreviewCharges({
        storedItem,
        form,
        photoPreviews,
        actorRole: user?.role,
        ownerRole: storedItem?.ownerRole ?? null,
      }),
    [storedItem, form, photoPreviews, user?.role]
  );

  const editConfirmNotes = useMemo(() => {
    if (!storedItem) return "";
    if (editPreviewCodes.length === 0) {
      return " Based on your edits, no credit charge is expected for this save.";
    }
    let sum = 0;
    let allKnown = true;
    for (const c of editPreviewCodes) {
      const n = getCost(c);
      if (n == null) allKnown = false;
      else sum += n;
    }
    const bal = chargesOwnerWallet
      ? ownerBal
      : Number(user?.credit_balance ?? 0);
    const balLabel = chargesOwnerWallet
      ? "Registered owner's balance"
      : "Your balance";
    if (allKnown) {
      let t = ` Estimated charge (combined steps): ${sum} credits. ${balLabel}: ${bal}.`;
      if (bal < sum) {
        t += ` Short by ${sum - bal} credits before saving (Credit pricing).`;
      }
      return t;
    }
    return " This save may use credits for theft reports, new photos, or field edits — see the banner below.";
  }, [
    storedItem,
    editPreviewCodes,
    getCost,
    user?.credit_balance,
    chargesOwnerWallet,
    ownerBal,
  ]);

  /** Immediate warning when the billed account (owner) cannot afford the cheapest step. */
  const showEntryCreditWarning = useMemo(() => {
    if (!storedItem || !user || tasksLoading) return false;
    if (!chargesOwnerWallet) return false;
    return isBalanceBelowMinimumForEdit(
      ownerBal,
      storedItem,
      getCost,
      user.role,
      ownerRoleForBilling
    );
  }, [
    storedItem,
    user,
    getCost,
    tasksLoading,
    chargesOwnerWallet,
    ownerBal,
    ownerRoleForBilling,
  ]);

  const showStaffOwnerInfo = useMemo(() => {
    if (!storedItem || !user || tasksLoading) return false;
    if (chargesOwnerWallet) return false;
    if (!isPrivilegedRole(user.role)) return false;
    if (!storedItem.ownerId || String(storedItem.ownerId) === String(user.id)) {
      return false;
    }
    return true;
  }, [storedItem, user, tasksLoading, chargesOwnerWallet]);

  const entryCreditWarningText = useMemo(() => {
    if (!showEntryCreditWarning || !storedItem || !user) return "";
    const min = getMinimumCreditForAnyEditAction(
      storedItem,
      getCost,
      user.role,
      ownerRoleForBilling
    );
    return formatInsufficientCreditsMessage(
      "The registered owner's balance is below the minimum credits usually needed for at least one update (edit details, add photos, or report stolen).",
      {
        creditsCost: min ?? undefined,
        balance: ownerBal,
        taskCode: null,
        balanceLabel: "Registered owner's balance",
      }
    );
  }, [
    showEntryCreditWarning,
    storedItem,
    user,
    getCost,
    ownerBal,
    ownerRoleForBilling,
  ]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  useEffect(() => {
    if (!storedItem) {
      setForm({
        category: "",
        make: "",
        model: "",
        serial1: "",
        serial2: "",
        village: "",
        ward: "",
        station: "",
        purchaseDate: "",
        estimatedValue: "",
        shop: "",
        warrantyExpiry: "",
        notes: "",
        status: "Active",
      });
      setHeldAtResidence(false);
      setExistingPhotos([]);
      setPhotoPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      setPoliceStation("");
      return;
    }

    const found = storedItem;
    const v = String(found.village || "").trim();
    const w = String(found.ward || "").trim();
    const st = String(found.station || found.location || "").trim();
    const uv = String(user?.village || "").trim();
    const uw = String(user?.ward || "").trim();
    const atHome = (!v && !w) || (uv && uw && v === uv && w === uw);
    setHeldAtResidence(!!atHome && !!uv);
    setForm({
      category: found.category || "",
      make: found.make || "",
      model: found.model || "",
      serial1: found.serial1 || "",
      serial2: found.serial2 || "",
      village: v || uv,
      ward: w || uw,
      station: st,
      purchaseDate: toDateInputValue(found.purchaseDate || found.lastSeen),
      estimatedValue:
        found.estimatedValue != null && found.estimatedValue !== ""
          ? String(found.estimatedValue)
          : "",
      shop: found.shop || "",
      warrantyExpiry: toDateInputValue(found.warrantyExpiry),
      notes: found.notes || "",
      status: isItemReportedStolen(found) ? "Stolen" : "Active",
    });
    setExistingPhotos(normalizePhotos(found.photos));
    setPhotoPreviews([]);
    setPoliceStation("");
  }, [storedItem, user?.village, user?.ward]);

  useEffect(() => {
    if (!heldAtResidence) return;
    setForm((f) => ({
      ...f,
      village:
        typeof user?.village === "string" && user.village.trim()
          ? user.village.trim()
          : f.village,
      ward:
        typeof user?.ward === "string" && user.ward.trim()
          ? user.ward.trim()
          : f.ward,
      station:
        typeof user?.police_station === "string" && user.police_station.trim()
          ? user.police_station.trim()
          : f.station,
    }));
  }, [heldAtResidence, user?.village, user?.ward, user?.police_station]);

  const villageOptions = useMemo(() => {
    const s = new Set(
      (items || [])
        .map((it) => String(it?.village || "").trim())
        .filter(Boolean)
    );
    const u = String(user?.village || "").trim();
    if (u) s.add(u);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items, user?.village]);

  const wardOptions = useMemo(() => {
    const s = new Set(
      (items || [])
        .map((it) => String(it?.ward || "").trim())
        .filter(Boolean)
    );
    const u = String(user?.ward || "").trim();
    if (u) s.add(u);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items, user?.ward]);

  // stationOptions now loaded from DB via PoliceStationSelect

  useEffect(() => {
    if (!form.serial1.trim()) {
      setSerialError(null);
      setSerialCheckWarning(null);
      return;
    }

    if (storedItem && form.serial1.trim() === String(storedItem.serial1 || "").trim()) {
      setSerialError(null);
      setSerialCheckWarning(null);
      return;
    }

    const checked = form.serial1.trim();

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await invokeWithAuth("check-serial", {
          body: { serial1: checked },
        });

        if (latestSerial1Ref.current.trim() !== checked) return;

        if (error) {
          setSerialError(null);
          setSerialCheckWarning(
            "Could not verify this serial number. Duplicate serials will be rejected by the registry."
          );
          return;
        }

        setSerialCheckWarning(null);

        if (data?.exists) {
          setSerialError("This serial number already exists.");
        } else {
          setSerialError(null);
        }
      } catch {
        if (latestSerial1Ref.current.trim() !== checked) return;
        setSerialError(null);
        setSerialCheckWarning(
          "Could not verify this serial number. Duplicate serials will be rejected by the registry."
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.serial1, storedItem]);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleCurrencyChange(e) {
    let raw = e.target.value;
    raw = raw.replace(/[^\d.]/g, "");
    const parts = raw.split(".");
    if (parts.length > 2) {
      raw = parts[0] + "." + parts[1];
    }
    updateField("estimatedValue", raw);
  }

  function isFieldInvalid(field) {
    return requiredFields.includes(field) && !form[field]?.trim();
  }

  const isFormInvalid =
    !!serialError || requiredFields.some((f) => !form[f]?.trim());

  async function processFiles(files) {
    const max = 5;
    const room = max - existingPhotos.length - photoPreviews.length;
    const selected = Array.from(files).slice(0, Math.max(0, room));

    if (selected.length === 0) {
      await alert({
        title: "Photos",
        message: `You can have at most ${max} photos per item.`,
        variant: "warning",
      });
      return;
    }

    const previews = await Promise.all(
      selected.map(async (file) => {
        const compressed = await compressImage(file);
        return {
          file: compressed,
          url: URL.createObjectURL(compressed),
        };
      })
    );

    setPhotoPreviews((prev) => [...prev, ...previews]);
  }

  async function handlePhotos(e) {
    const input = e.target;
    const files = input.files;
    if (!files?.length) return;
    try {
      await processFiles(files);
    } catch (err) {
      await alert({
        title: "Photos",
        message: err.message || "Could not process one or more images.",
        variant: "error",
      });
    } finally {
      input.value = "";
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        await processFiles(e.dataTransfer.files);
      } catch (err) {
        await alert({
          title: "Photos",
          message: err.message || "Could not process one or more images.",
          variant: "error",
        });
      }
    }
  }

  function moveExistingPhoto(fromIndex, toIndex) {
    setExistingPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function moveNewPhoto(fromIndex, toIndex) {
    setPhotoPreviews((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function removeExistingPhoto(index) {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function removeNewPhoto(index) {
    setPhotoPreviews((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  }

  function cancelUpload() {
    uploadCancelledRef.current = true;
    activeXhrs.current.forEach((xhr) => xhr.abort());
    activeXhrs.current = [];
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentUpload(0);
    setTotalUploads(0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!storedItem) return;
    if (isItemFrozen(storedItem)) {
      await alert({
        title: "Read only",
        message: "This item is deleted or legacy and can only be restored.",
        variant: "warning",
      });
      return;
    }

    if (serialError) {
      await alert({
        title: "Serial Conflict",
        message: "Please resolve the serial number conflict before saving.",
        variant: "error",
      });
      return;
    }

    for (const f of requiredFields) {
      if (!form[f]?.trim()) {
        const label =
          f === "serial1"
            ? "the primary serial number"
            : f === "station"
              ? "the nearest police station"
              : f;
        await alert({
          title: "Missing Information",
          message: `Please fill in ${label}.`,
          variant: "warning",
        });
        return;
      }
    }

    const maxPhotos = 5;
    if (existingPhotos.length + photoPreviews.length > maxPhotos) {
      await alert({
        title: "Photos",
        message: `At most ${maxPhotos} photos per item.`,
        variant: "warning",
      });
      return;
    }

    let photosPayload = existingPhotos.map((p) => ({
      original: p.original,
      thumb: p.thumb,
    }));

    try {
      const confirmed = await confirm({
        title: "Confirm",
        message: `Save changes to this item? This will update the item record immediately.${editConfirmNotes}`,
        confirmLabel: "Save changes",
        cancelLabel: "Cancel",
      }).catch(() => false);
      if (!confirmed) return;

      if (photoPreviews.length > 0) {
        uploadCancelledRef.current = false;
        setIsUploading(true);
        setUploadProgress(0);
        setCurrentUpload(0);
        setTotalUploads(photoPreviews.length);

        const { data: uploadInit, error: uploadError } = await invokeWithAuth(
          "generate-upload-urls",
          {
            body: {
              itemId: storedItem.id,
              files: photoPreviews.map((p) => ({
                name: p.file.name,
                type: p.file.type,
                size: p.file.size,
              })),
            },
          }
        );

        if (uploadError || !uploadInit?.success) {
          throw new Error(
            uploadInit?.message || "Could not start photo upload."
          );
        }

        let completed = 0;
        const totalBytes = photoPreviews.reduce((sum, p) => sum + p.file.size, 0);
        let uploadedBytes = 0;

        await Promise.all(
          uploadInit.uploads.map((upload, i) => {
            const file = photoPreviews[i]?.file;
            if (!file) throw new Error("Photo upload mismatch.");

            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              activeXhrs.current.push(xhr);

              xhr.open("PUT", upload.signedUrl);
              xhr.setRequestHeader("Content-Type", file.type);

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const previous = xhr._lastLoaded || 0;
                  const delta = event.loaded - previous;
                  xhr._lastLoaded = event.loaded;
                  uploadedBytes += delta;
                  const percent = Math.round((uploadedBytes / totalBytes) * 100);
                  setUploadProgress(Math.min(percent, 100));
                }
              };

              xhr.onload = () => {
                activeXhrs.current = activeXhrs.current.filter((x) => x !== xhr);
                if (xhr.status >= 200 && xhr.status < 300) {
                  completed++;
                  setCurrentUpload(completed);
                  resolve();
                } else {
                  reject(new Error("Failed to upload one of the photos."));
                }
              };

              xhr.onerror = () => {
                activeXhrs.current = activeXhrs.current.filter((x) => x !== xhr);
                reject(new Error("Upload failed."));
              };

              xhr.send(file);
            });
          })
        );

        setUploadProgress(100);

        await Promise.all(
          uploadInit.uploads.map((u) =>
            invokeWithAuth("generate-thumbnail", {
              body: {
                originalPath: u.path,
                thumbPath: u.thumbPath,
              },
            })
          )
        );

        const newEntries = uploadInit.uploads.map((u) => ({
          original: u.path,
          thumb: u.thumbPath,
        }));

        photosPayload = [...photosPayload, ...newEntries];

        await Promise.all(
          uploadInit.uploads.map((u) =>
            invokeWithAuth("create-embedding-job", {
              body: {
                itemId: storedItem.id,
                photoPath: u.path,
                thumbPath: u.thumbPath,
              },
            })
          )
        );
      }

      const updates = {
        category: form.category.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        serial1: form.serial1.trim(),
        serial2: form.serial2.trim(),
        village: form.village.trim() || undefined,
        ward: form.ward.trim() || undefined,
        station: form.station.trim(),
        location: form.station.trim(),
        purchaseDate: form.purchaseDate || undefined,
        estimatedValue: form.estimatedValue
          ? Number(form.estimatedValue)
          : undefined,
        shop: form.shop.trim(),
        warrantyExpiry: form.warrantyExpiry || undefined,
        notes: form.notes.trim(),
        status: form.status,
        photos: photosPayload,
      };

      const extra = {};
      if (
        form.status === "Stolen" &&
        !isItemReportedStolen(storedItem) &&
        policeStation.trim()
      ) {
        extra.policeStation = policeStation.trim();
      }

      const updated = await updateItem(storedItem.id, updates, extra);

      photoPreviews.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotoPreviews([]);

      const slug = updated?.slug || storedItem.slug;
      await alert({
        title: "Saved",
        message: "Your changes were saved.",
        variant: "success",
        mode: "alert",
      });
      navigate(`/items/${slug}`);
    } catch (err) {
      if (uploadCancelledRef.current) {
        await alert({
          title: "Upload Cancelled",
          message: "Photo upload was cancelled.",
          variant: "warning",
        });
        return;
      }
      await alert({
        title: "Could not save",
        message: formatBilling(err),
        variant: "error",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(0);
    }
  }

  async function handleDelete() {
    if (!storedItem) return;
    const confirmed = await confirm({
      title: "Confirm",
      message: "Delete this item? This cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!confirmed) return;

    try {
      await deleteItem(storedItem.id);
      navigate("/items");
    } catch (err) {
      await alert({
        title: "Delete failed",
        message: err.message || "Could not delete item.",
        variant: "error",
      });
    }
  }

  if (itemPageLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!storedItem) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            <h2 className="text-lg font-semibold">Item not found</h2>
            <p className="text-sm text-gray-500 mt-2">
              Open this page from your items list, or the item may not be loaded yet.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <RippleButton
                className="px-4 py-2 rounded border bg-white"
                onClick={() => navigate("/items")}
              >
                Back to items
              </RippleButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const photoRoom = 5 - existingPhotos.length - photoPreviews.length;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {showEntryCreditWarning ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <div className="font-semibold">Owner has insufficient credits</div>
            <p className="mt-1 whitespace-pre-line">{entryCreditWarningText}</p>
            <BillingHelpLinks className="mt-2" />
          </div>
        ) : null}

        {showStaffOwnerInfo ? (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <div className="font-semibold">Staff edit (reference)</div>
            <p className="mt-1">
              Registered owner&apos;s balance:{" "}
              <span className="tabular-nums font-semibold">{ownerBal}</span>{" "}
              credits. Standard updates performed by staff do not debit this
              owner&apos;s wallet.
            </p>
          </div>
        ) : null}

        {isItemFrozen(storedItem) ? (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            <div className="font-semibold">Read only</div>
            <p className="mt-1">
              This item is deleted or legacy. Restore it from the item page before
              you can change details or photos.
            </p>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-8 pt-8 pb-5 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 border-b border-emerald-100/80">
            <div>
              <h1 className="text-2xl font-bold text-iregistrygreen">Edit item</h1>
              <p className="text-sm text-gray-500">
                Update details for {storedItem.name || "this item"}
              </p>
            </div>
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-white self-start shadow-sm disabled:opacity-50"
              onClick={handleDelete}
              disabled={isItemFrozen(storedItem)}
            >
              Delete item
            </RippleButton>
          </div>

          <div className="p-8 space-y-6">
          <fieldset
            disabled={isItemFrozen(storedItem)}
            className="border-0 p-0 m-0 min-w-0 space-y-6 disabled:opacity-[0.72]"
          >
          <CategoryMakeModelSelect
            category={form.category}
            make={form.make}
            model={form.model}
            required={true}
            disabled={isItemFrozen(storedItem)}
            onCategoryChange={(v) =>
              setForm((f) => ({ ...f, category: v, make: "", model: "" }))
            }
            onMakeChange={(v) => setForm((f) => ({ ...f, make: v, model: "" }))}
            onModelChange={(v) => updateField("model", v)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Serial number" required>
              <input
                name="serial1"
                value={form.serial1}
                onChange={(e) => updateField("serial1", e.target.value)}
                className={`input ${isFieldInvalid("serial1") ? "border-red-500 ring-red-500" : ""}`}
              />
              {serialError && (
                <p className="text-xs text-red-600 mt-1">{serialError}</p>
              )}
              {serialCheckWarning && !serialError && (
                <p className="text-xs text-amber-700 mt-1">{serialCheckWarning}</p>
              )}
            </Field>
            <Field label="Secondary serial">
              <input
                name="serial2"
                value={form.serial2}
                onChange={(e) => updateField("serial2", e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Item location">
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
              <input
                type="checkbox"
                checked={heldAtResidence}
                onChange={(e) => setHeldAtResidence(e.target.checked)}
              />
              Item is held at my place of residence
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Town/Village</label>
                <input
                  name="village"
                  value={form.village}
                  onChange={(e) => updateField("village", e.target.value)}
                  className="input"
                  list="edit-village-options"
                  disabled={heldAtResidence}
                />
                <datalist id="edit-village-options">
                  {villageOptions.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ward/Street</label>
                <input
                  name="ward"
                  value={form.ward}
                  onChange={(e) => updateField("ward", e.target.value)}
                  className="input"
                  list="edit-ward-options"
                  disabled={heldAtResidence}
                />
                <datalist id="edit-ward-options">
                  {wardOptions.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </div>
            </div>
          </Field>

          <Field label="Nearest police station" required>
            <PoliceStationSelect
              label={null}
              value={form.station}
              onChange={(v) => updateField("station", v)}
              required={true}
              withAuth={true}
              inputClassName={`input ${isFieldInvalid("station") ? "border-red-500 ring-red-500" : ""}`}
              placeholder="Select nearest police station…"
              allowOther={true}
            />
          </Field>

          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="input"
            >
              <option value="Active">Active</option>
              <option value="Stolen">Stolen</option>
            </select>
          </Field>

          {form.status === "Stolen" && !isItemReportedStolen(storedItem) && (
            <Field label="Reporting station (optional)">
              <PoliceStationSelect
                label={null}
                value={policeStation}
                onChange={(v) => setPoliceStation(v)}
                required={false}
                withAuth={true}
                inputClassName="input"
                placeholder="Select reporting station (optional)…"
                allowOther={true}
                helpText="Leave blank to default to the nearest police station on file."
              />
            </Field>
          )}

          <Field label="Shop / retailer">
            <input
              name="shop"
              value={form.shop}
              onChange={(e) => updateField("shop", e.target.value)}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Purchase date">
              <input
                name="purchaseDate"
                type="date"
                value={form.purchaseDate}
                onChange={(e) => updateField("purchaseDate", e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Warranty expiry">
              <input
                name="warrantyExpiry"
                type="date"
                value={form.warrantyExpiry}
                onChange={(e) => updateField("warrantyExpiry", e.target.value)}
                className="input"
                min={form.purchaseDate || undefined}
              />
            </Field>
          </div>

          <Field label="Estimated Value (P)">
            <input
              name="estimatedValue"
              value={
                estimatedValueFocused
                  ? form.estimatedValue
                  : formatBwpCurrency(form.estimatedValue, { empty: "" })
              }
              onChange={handleCurrencyChange}
              onFocus={() => setEstimatedValueFocused(true)}
              onBlur={() => setEstimatedValueFocused(false)}
              className="input tabular-nums"
              placeholder="e.g. 1500"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="input h-24"
            />
          </Field>

          <div className="border-t pt-6 mt-6 space-y-4">
            <Field label={`Photos (max 5) — ${photoRoom} slot(s) left`}>
              {existingPhotos.length > 0 && (
                <p className="text-xs text-gray-500 mb-2">Current photos (drag to reorder)</p>
              )}
              {existingPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {existingPhotos.map((p, i) => (
                    <div
                      key={`ex-${p.original}-${i}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("exIndex", String(i))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const from = Number(e.dataTransfer.getData("exIndex"));
                        moveExistingPhoto(from, i);
                      }}
                      className="relative group cursor-move"
                    >
                      <img
                        src={photoThumbUrl(p) || ""}
                        alt=""
                        className="rounded-lg h-24 w-full object-cover border"
                      />
                      {i === 0 && (
                        <div className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">
                          Thumbnail
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExistingPhoto(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photoRoom > 0 && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
                    ${dragActive
                      ? "border-iregistrygreen bg-emerald-50"
                      : "border-gray-300 bg-gray-50 hover:bg-gray-100"}
                  `}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotos}
                    className="hidden"
                    id="edit-photo-upload"
                  />
                  <label htmlFor="edit-photo-upload" className="cursor-pointer block">
                    <div className="text-sm text-gray-600">
                      Add photos — drag here or{" "}
                      <span className="text-iregistrygreen font-medium">browse</span>
                    </div>
                  </label>
                </div>
              )}

              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {photoPreviews.map((p, i) => (
                    <div
                      key={p.url}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("newIndex", String(i))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const from = Number(e.dataTransfer.getData("newIndex"));
                        moveNewPhoto(from, i);
                      }}
                      className="relative group cursor-move"
                    >
                      <img
                        src={p.url}
                        alt="new"
                        className="rounded-lg h-24 w-full object-cover border"
                      />
                      <div className="absolute bottom-1 left-1 text-[10px] bg-emerald-800/80 text-white px-1 rounded">
                        New
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewPhoto(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </div>
          </fieldset>

          {isUploading && (
            <div className="mb-4 space-y-3">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-iregistrygreen h-2 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-right">
                Uploading {currentUpload} / {totalUploads}…
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Cancel upload
                </button>
              </div>
            </div>
          )}

          <BillingCostBanner
            taskCodes={editPreviewCodes}
            title="Credits for this save"
            subtitle="Charges apply per step (mark stolen, new photos, or other field edits). Staff roles may be exempt."
          />

          <div className="flex justify-end gap-3 pt-4">
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-100"
              onClick={() => navigate(`/items/${storedItem.slug}`)}
            >
              Cancel
            </RippleButton>
            <RippleButton
              type="submit"
              disabled={
                isFormInvalid ||
                isUploading ||
                itemPageLoading ||
                isItemFrozen(storedItem)
              }
              className="px-5 py-2 rounded-lg bg-iregistrygreen text-white disabled:opacity-50"
            >
              {isUploading ? `Uploading ${currentUpload}/${totalUploads}` : "Save changes"}
            </RippleButton>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
