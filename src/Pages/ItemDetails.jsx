// src/Pages/ItemDetails.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Toast from "../components/Toast.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { formatBwpCurrency } from "../lib/formatBWP.js";
import ItemActivityTimeline from "../components/ItemActivityTimeline";
import { useItemActivity } from "../hooks/useItemActivity";
import { useModal } from "../contexts/ModalContext.jsx";
import { normalizePhotos } from "../utils/itemPhotos.js";
import { compressImage } from "../utils/imageCompression.js";
import {
  isBalanceBelowMinimumForEdit,
  getMinimumCreditForAnyEditAction,
  formatInsufficientCreditsMessage,
} from "../lib/billingUx.js";
import { useTaskPricing } from "../hooks/useTaskPricing.js";

const MAX_PHOTOS = 5;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Public storage URL for a photo entry ({ original, thumb }) or legacy path string.
 * @param {boolean} preferMain — true: hero uses original first; false: strip uses thumb first
 */
function photoStoragePublicUrl(entry, preferMain = false) {
  if (!entry || !SUPABASE_URL) return null;

  const raw = (() => {
    if (typeof entry === "string") return entry.trim();
    if (typeof entry === "object" && entry) {
      return preferMain
        ? (entry.original || entry.thumb || "").trim()
        : (entry.thumb || entry.original || "").trim();
    }
    return "";
  })();

  if (!raw) return null;

  // If it's already a full URL, use it as-is.
  if (/^https?:\/\//i.test(raw)) return raw;

  // If it already includes our public prefix, don't double-prefix.
  const publicPrefix = `${SUPABASE_URL}/storage/v1/object/public/item-photos/`;
  if (raw.startsWith(publicPrefix)) return raw;

  // Handle raw values that start with "/storage/..." (missing domain)
  const relPrefix = "/storage/v1/object/public/item-photos/";
  if (raw.startsWith(relPrefix)) return `${SUPABASE_URL}${raw}`;

  const relPrefixNoSlash = "storage/v1/object/public/item-photos/";
  if (raw.startsWith(relPrefixNoSlash)) return `${SUPABASE_URL}/${raw}`;

  // Handle values that include the bucket name.
  const normalizedPath = raw.replace(/^item-photos\//i, "").replace(/^\/+/, "");
  if (!normalizedPath) return null;

  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${normalizedPath}`;
}

function itemPhotoUrls(item, preferMain = false) {
  const list = item?.photos;
  if (!Array.isArray(list) || list.length === 0) return [];
  return list
    .map((p) => photoStoragePublicUrl(p, preferMain))
    .filter(Boolean);
}

function photoEntryPath(entry, preferMain = false) {
  if (!entry) return null;
  if (typeof entry === "string") return entry.trim() || null;
  if (typeof entry === "object") {
    const raw = preferMain
      ? entry.original || entry.thumb || ""
      : entry.thumb || entry.original || "";
    return String(raw).trim() || null;
  }
  return null;
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatPoliceCaseStatusLabel(status) {
  if (!status) return "—";
  const map = {
    Open: "Open",
    InCustody: "In custody",
    ClearedForReturn: "Cleared for return",
    ReturnedToOwner: "Returned to owner",
  };
  return map[status] || status;
}

function normalizePoliceCaseRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    status: row.status,
    station: row.station,
    stationSource: row.station_source,
    openedAt: row.opened_at,
    clearedAt: row.cleared_at,
    returnedAt: row.returned_at,
    notes: row.notes,
    evidence: row.evidence,
  };
}

export default function ItemDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, deleteItem, updateItem, transferOwnership } = useItems();
  const { user } = useAuth();
  const { confirm } = useModal();
  const { getCost, loading: tasksLoading } = useTaskPricing();

  const [item, setItem] = useState(null);
  const [policeCaseDetail, setPoliceCaseDetail] = useState(null);
  const [policeCaseLoading, setPoliceCaseLoading] = useState(false);
  const { activity } = useItemActivity(item?.id);
  const [confirmOpen, setConfirmOpen] = useState(false); // modal state
  const [working, setWorking] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [signedMainPhotoUrls, setSignedMainPhotoUrls] = useState([]);
  const [signedThumbPhotoUrls, setSignedThumbPhotoUrls] = useState([]);

  // toast state
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });

  // admin transfer ownership (admin-only)
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferErr, setTransferErr] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [evidenceType, setEvidenceType] = useState("ADMIN_TRANSFER");
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [ownerUsers, setOwnerUsers] = useState([]);
  const [ownerUsersLoading, setOwnerUsersLoading] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);
  const activeXhrs = useRef([]);
  const uploadCancelledRef = useRef(false);
  const photoInputRef = useRef(null);

  const photosNormalized = useMemo(() => normalizePhotos(item?.photos), [item?.photos]);

  // Admins/cashiers may edit photos on any item. All other roles (including police) only on items they own.
  const canManagePhotos =
    !!user &&
    !!item &&
    (user.role === "admin" ||
      user.role === "cashier" ||
      String(user.id) === String(item.ownerId));

  useEffect(() => {
    const found = (items || []).find((it) => String(it.slug) === String(slug));
    setItem(found || null);
    setPhotoIndex(0);
  }, [slug, items]);

  // If `item-photos` is not public, we need signed URLs for <img src>.
  // This keeps the page working regardless of bucket visibility.
  useEffect(() => {
    let cancelled = false;

    async function loadSignedUrls() {
      if (!item?.id) {
        setSignedMainPhotoUrls([]);
        setSignedThumbPhotoUrls([]);
        return;
      }

      const photosList = Array.isArray(item?.photos) ? item.photos : [];
      const mainPaths = photosList
        .map((p) => photoEntryPath(p, true))
        .filter(Boolean);
      const thumbPaths = photosList
        .map((p) => photoEntryPath(p, false))
        .filter(Boolean);

      if (mainPaths.length === 0 && thumbPaths.length === 0) {
        setSignedMainPhotoUrls([]);
        setSignedThumbPhotoUrls([]);
        return;
      }

      try {
        const [mainRes, thumbRes] = await Promise.all([
          invokeWithAuth("get-item-photo-urls", {
            body: { itemId: item.id, paths: mainPaths },
          }),
          invokeWithAuth("get-item-photo-urls", {
            body: { itemId: item.id, paths: thumbPaths },
          }),
        ]);

        if (cancelled) return;

        const mainUrls = mainRes?.data?.success ? mainRes.data.urls : [];
        const thumbUrls = thumbRes?.data?.success ? thumbRes.data.urls : [];

        setSignedMainPhotoUrls((mainUrls || []).filter(Boolean));
        setSignedThumbPhotoUrls((thumbUrls || []).filter(Boolean));
      } catch {
        // If signing fails for any reason, fallback to public URLs below.
        if (!cancelled) {
          setSignedMainPhotoUrls([]);
          setSignedThumbPhotoUrls([]);
        }
      }
    }

    void loadSignedUrls();

    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.photos]);

  useEffect(() => {
    if (!item?.id || item.status !== "Stolen") {
      setPoliceCaseDetail(null);
      return;
    }

    let cancelled = false;
    setPoliceCaseLoading(true);

    (async () => {
      try {
        const { data, error } = await invokeWithAuth("get-item-police-case", {
          body: { itemId: item.id },
        });
        if (cancelled) return;
        if (error && !data?.message) {
          setPoliceCaseDetail(null);
          return;
        }
        if (data?.success && data.case) {
          setPoliceCaseDetail(normalizePoliceCaseRow(data.case));
        } else {
          setPoliceCaseDetail(null);
        }
      } catch {
        if (!cancelled) setPoliceCaseDetail(null);
      } finally {
        if (!cancelled) setPoliceCaseLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.status]);

  function openDeleteModal() {
    setConfirmOpen(true);
  }

  function closeDeleteModal() {
    setConfirmOpen(false);
  }

  async function performDelete() {
    if (!item) return;
    try {
      setWorking(true);
      const res = deleteItem(item.id);
      if (res && typeof res.then === "function") {
        await res;
      }
      // show success toast briefly then navigate
      setToast({ visible: true, message: `${item.name || item.id} deleted`, type: "success" });
      // small delay so user sees toast before navigation
      setTimeout(() => {
        setToast({ visible: false, message: "", type: "info" });
        navigate("/items");
      }, 900);
    } catch (e) {
      console.error("Failed to delete item:", e);
      setToast({ visible: true, message: "Failed to delete item", type: "error" });
      setTimeout(() => setToast({ visible: false, message: "", type: "info" }), 2500);
    } finally {
      setWorking(false);
      setConfirmOpen(false);
    }
  }

  // wrapper that ConfirmModal can call as action
  function handleDeleteAction() {
    void performDelete();
  }

  function showToastMsg(msg, type = "info") {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3200);
  }

  async function goToEdit() {
    if (!item?.slug) return;
    const path = `/items/${item.slug}/edit`;
    const role = user?.role;
    if (["admin", "cashier"].includes(String(role || "").toLowerCase())) {
      navigate(path);
      return;
    }
    if (tasksLoading) return;

    const balance = Number(user?.credit_balance ?? 0);
    if (isBalanceBelowMinimumForEdit(balance, item, getCost, role)) {
      const min = getMinimumCreditForAnyEditAction(item, getCost, role);
      const msg = formatInsufficientCreditsMessage(
        "Your balance is below the minimum credits usually needed for at least one update (edit details, add photos, or report stolen).",
        {
          creditsCost: min ?? undefined,
          balance,
          taskCode: null,
        }
      );
      const proceed = await confirm({
        title: "Credit balance is low",
        message: msg,
        confirmLabel: "Continue to editor",
        cancelLabel: "Stay here",
        variant: "warning",
      }).catch(() => false);
      if (!proceed) return;
    }
    navigate(path);
  }

  function openTransferOwnershipModal() {
    if (!item?.id) return;
    setTransferErr("");
    setNewOwnerId("");
    setEvidenceType("ADMIN_TRANSFER");
    setEvidenceFile(null);
    setOwnerQuery("");
    setOwnerPickerOpen(false);
    setTransferOpen(true);
  }

  function closeTransferOwnershipModal() {
    if (transferBusy) return;
    setTransferOpen(false);
  }

  async function submitTransferOwnership() {
    if (!item?.id) return;
    const target = String(newOwnerId || "").trim();
    if (!target) {
      setTransferErr("New owner user ID is required.");
      return;
    }
    if (!evidenceFile) {
      setTransferErr("Evidence file is required (PDF or image).");
      return;
    }
    const type = String(evidenceType || "").trim();
    if (!type) {
      setTransferErr("Evidence type is required.");
      return;
    }

    const ok = await confirm({
      title: "Confirm",
      message: "Transfer ownership to the specified user? This action updates the item owner immediately.",
      confirmLabel: "Transfer ownership",
      cancelLabel: "Cancel",
      variant: "warning",
    }).catch(() => false);
    if (!ok) return;

    setTransferBusy(true);
    setTransferErr("");
    try {
      const form = new FormData();
      form.set("file", evidenceFile);
      form.set("itemId", String(item.id));
      form.set("type", type);
      form.set("referenceId", `admin_transfer:${String(item.id)}`);

      const { data: up, error: upErr } = await invokeWithAuth("upload-ownership-evidence", {
        body: form,
      });

      if (upErr || !up?.success || !up?.evidence) {
        throw new Error(up?.message || upErr?.message || "Failed to upload evidence");
      }

      await transferOwnership({
        itemId: String(item.id),
        newOwnerId: target,
        evidence: up.evidence,
      });

      showToastMsg("Ownership transferred successfully.", "success");
      setTransferOpen(false);
    } catch (e) {
      const msg = e?.message || "Ownership transfer failed";
      setTransferErr(msg);
      showToastMsg(msg, "error");
    } finally {
      setTransferBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadOwners() {
      if (!transferOpen) return;
      if (user?.role !== "admin") return;
      setOwnerUsersLoading(true);
      try {
        const { data, error } = await invokeWithAuth("list-users");
        if (cancelled) return;
        if (error || !data?.success) {
          throw new Error(data?.message || error?.message || "Failed to load users");
        }
        const all = Array.isArray(data?.users) ? data.users : [];
        // "registered owner" = normal app users (exclude staff roles)
        const owners = all.filter((u) => String(u?.role || "").toLowerCase() === "user");
        setOwnerUsers(owners);
      } catch (e) {
        if (!cancelled) {
          setOwnerUsers([]);
          setTransferErr(e?.message || "Failed to load users");
        }
      } finally {
        if (!cancelled) setOwnerUsersLoading(false);
      }
    }
    void loadOwners();
    return () => {
      cancelled = true;
    };
  }, [transferOpen, user?.role]);

  const filteredOwners = useMemo(() => {
    const q = String(ownerQuery || "").trim().toLowerCase();
    if (!q) return ownerUsers;
    return (ownerUsers || []).filter((u) => {
      const hay = [
        u?.first_name || "",
        u?.last_name || "",
        u?.email || "",
        u?.id_number || "",
        u?.phone || "",
        u?.id || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ownerUsers, ownerQuery]);

  const selectedOwnerLabel = useMemo(() => {
    if (!newOwnerId) return "";
    const u = (ownerUsers || []).find((x) => String(x?.id) === String(newOwnerId));
    if (!u) return "";
    const name = `${String(u?.first_name || "").trim()} ${String(u?.last_name || "").trim()}`.trim();
    return name || u?.email || u?.id_number || u?.id || "";
  }, [newOwnerId, ownerUsers]);

  function handleDragZone(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  async function handleDropFiles(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!canManagePhotos || !item || !e.dataTransfer?.files?.length) return;
    await processFiles(e.dataTransfer.files);
  }

  async function processFiles(fileList) {
    if (!item || !canManagePhotos) return;
    const room = MAX_PHOTOS - photosNormalized.length;
    const selected = Array.from(fileList).slice(0, Math.max(0, room));
    if (selected.length === 0) {
      showToastMsg(`You can have at most ${MAX_PHOTOS} photos per item.`, "error");
      return;
    }
    const previews = await Promise.all(
      selected.map(async (file) => {
        const compressed = await compressImage(file);
        return { file: compressed, url: URL.createObjectURL(compressed) };
      })
    );
    await uploadCompressedPreviews(previews);
  }

  async function uploadCompressedPreviews(previews) {
    if (!item || previews.length === 0) return;
    const ok = await confirm({
      title: "Upload photos",
      message: `Upload ${previews.length} new photo(s) to this item? This will update the item record.`,
      confirmLabel: "Upload",
      cancelLabel: "Cancel",
    }).catch(() => false);
    if (!ok) return;

    uploadCancelledRef.current = false;
    setIsUploading(true);
    setUploadProgress(0);
    setCurrentUpload(0);
    setTotalUploads(previews.length);
    try {
      const { data: uploadInit, error: uploadError } = await invokeWithAuth("generate-upload-urls", {
        body: {
          itemId: item.id,
          files: previews.map((p) => ({
            name: p.file.name,
            type: p.file.type,
            size: p.file.size,
          })),
        },
      });
      if (uploadError || !uploadInit?.success) {
        throw new Error(uploadInit?.message || "Could not start photo upload.");
      }
      let completed = 0;
      const totalBytes = previews.reduce((sum, p) => sum + p.file.size, 0);
      let uploadedBytes = 0;
      await Promise.all(
        uploadInit.uploads.map((upload, i) => {
          const file = previews[i]?.file;
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
                setUploadProgress(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
              }
            };
            xhr.onload = () => {
              activeXhrs.current = activeXhrs.current.filter((x) => x !== xhr);
              if (xhr.status >= 200 && xhr.status < 300) {
                completed++;
                setCurrentUpload(completed);
                resolve();
              } else reject(new Error("Upload failed."));
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
            body: { originalPath: u.path, thumbPath: u.thumbPath },
          })
        )
      );
      const newEntries = uploadInit.uploads.map((u) => ({ original: u.path, thumb: u.thumbPath }));
      const merged = [
        ...photosNormalized.map((p) => ({ original: p.original, thumb: p.thumb })),
        ...newEntries,
      ];
      await updateItem(item.id, { photos: merged });
      await Promise.all(
        uploadInit.uploads.map((u) =>
          invokeWithAuth("create-embedding-job", {
            body: { itemId: item.id, photoPath: u.path, thumbPath: u.thumbPath },
          })
        )
      );
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      showToastMsg("Photos updated.", "success");
      setPhotoIndex(Math.max(0, merged.length - 1));
    } catch (err) {
      if (uploadCancelledRef.current) {
        showToastMsg("Upload cancelled.", "warning");
      } else {
        showToastMsg(err.message || "Upload failed.", "error");
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(0);
      activeXhrs.current = [];
    }
  }

  async function handlePhotoInputChange(e) {
    const input = e.target;
    const files = input.files;
    if (!files?.length) return;
    try {
      await processFiles(files);
    } catch (err) {
      showToastMsg(err.message || "Could not process images.", "error");
    } finally {
      input.value = "";
    }
  }

  function openPhotoPicker() {
    if (!canManagePhotos || isUploading || !item) return;
    const room = MAX_PHOTOS - photosNormalized.length;
    if (room <= 0) {
      showToastMsg(`Maximum ${MAX_PHOTOS} photos per item.`, "warning");
      return;
    }
    photoInputRef.current?.click();
  }

  async function applyPhotoReorder(fromIndex, toIndex) {
    if (!item || fromIndex === toIndex) return;
    const next = [...photosNormalized];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    try {
      await updateItem(item.id, { photos: next });
      setPhotoIndex((prev) => {
        if (prev === fromIndex) return toIndex;
        if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) return prev - 1;
        if (fromIndex > toIndex && prev >= toIndex && prev < fromIndex) return prev + 1;
        return prev;
      });
    } catch (err) {
      showToastMsg(err.message || "Could not reorder photos.", "error");
    }
  }

  function requestPhotoReorder(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    void confirm({
      title: "Apply new photo order?",
      message:
        "The first photo is used as the main image on this page and in lists. Save this order?",
      confirmLabel: "Apply order",
      cancelLabel: "Cancel",
      variant: "warning",
      onConfirm: async () => {
        await applyPhotoReorder(fromIndex, toIndex);
      },
    });
  }

  async function applyPhotoRemove(index) {
    if (!item) return;
    const next = photosNormalized.filter((_, i) => i !== index);
    try {
      await updateItem(item.id, { photos: next });
      setPhotoIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
    } catch (err) {
      showToastMsg(err.message || "Could not remove photo.", "error");
    }
  }

  function requestPhotoRemove(index) {
    void confirm({
      title: "Remove this photo?",
      message:
        "This photo will be removed from the item. You can add new photos later if you need to.",
      confirmLabel: "Remove",
      cancelLabel: "Keep",
      danger: true,
      onConfirm: async () => {
        await applyPhotoRemove(index);
      },
    });
  }

  function cancelUpload() {
    uploadCancelledRef.current = true;
    activeXhrs.current.forEach((xhr) => xhr.abort());
    activeXhrs.current = [];
    setIsUploading(false);
    setUploadProgress(0);
  }

  const publicMainPhotoUrls = item ? itemPhotoUrls(item, true) : [];
  const publicThumbPhotoUrls = item ? itemPhotoUrls(item, false) : [];

  const mainPhotoUrls =
    signedMainPhotoUrls.length > 0 ? signedMainPhotoUrls : publicMainPhotoUrls;
  const thumbPhotoUrls =
    signedThumbPhotoUrls.length > 0 ? signedThumbPhotoUrls : publicThumbPhotoUrls;
  const fallbackImage = item?.imageUrl?.trim() || null;
  const mainPhotoSrc =
    mainPhotoUrls.length > 0
      ? mainPhotoUrls[Math.min(photoIndex, mainPhotoUrls.length - 1)]
      : fallbackImage;

  const photoRoom = MAX_PHOTOS - photosNormalized.length;

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            <h2 className="text-lg font-semibold">Item not found</h2>
            <p className="text-sm text-gray-500 mt-2">The requested item does not exist.</p>
            <div className="mt-4 flex gap-2 justify-center">
              <RippleButton className="px-4 py-2 rounded border bg-white" onClick={() => navigate("/items")}>
                Back to items
              </RippleButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-emerald-100/70 bg-gradient-to-r from-emerald-50/95 via-emerald-50/50 to-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-iregistrygreen truncate">
                    {item.name || "Untitled"}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${
                      item.status === "Stolen"
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-emerald-50 text-emerald-800 border-emerald-100"
                    }`}
                  >
                    {item.status || "—"}
                  </span>
                  {item.category ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border bg-gray-50 text-gray-700 border-gray-100">
                      {item.category}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Serial: <span className="font-medium text-gray-800">{item.serial1 || "—"}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  Updated: <span className="font-medium text-gray-800">{fmtDate(item.updatedOn) || "—"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <RippleButton
                  className="px-4 py-2 rounded-xl border bg-white text-sm"
                  onClick={() => navigate("/items")}
                >
                  Back
                </RippleButton>

                {user?.role === "admin" ? (
                  <RippleButton
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm"
                    onClick={openTransferOwnershipModal}
                  >
                    Transfer ownership
                  </RippleButton>
                ) : null}

                <RippleButton
                  className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm disabled:opacity-60"
                  onClick={() => void goToEdit()}
                  disabled={tasksLoading}
                  title={tasksLoading ? "Loading credit prices…" : undefined}
                >
                  Edit
                </RippleButton>

                <RippleButton
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm"
                  onClick={openDeleteModal}
                >
                  Delete
                </RippleButton>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Media + quick facts */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Photos
                  </div>
                  <div className="flex flex-col items-center justify-center gap-3">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoInputChange}
                    />

                    {canManagePhotos ? (
                      <>
                        <div
                          className={`relative w-full max-w-[22rem] aspect-square rounded-2xl border-2 overflow-hidden cursor-pointer transition-colors ${
                            dragActive
                              ? "border-iregistrygreen bg-emerald-50"
                              : "border-gray-200 bg-gray-50 hover:border-iregistrygreen/50"
                          } ${isUploading ? "cursor-wait" : ""}`}
                          onDragEnter={handleDragZone}
                          onDragLeave={handleDragZone}
                          onDragOver={handleDragZone}
                          onDrop={handleDropFiles}
                          onClick={openPhotoPicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openPhotoPicker();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label="Add photos — click or drop images here"
                        >
                          {mainPhotoSrc ? (
                            <img
                              src={mainPhotoSrc}
                              alt={item.name || "Item photo"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 px-2 text-center">
                              <div className="text-3xl mb-1">＋</div>
                              <span className="text-xs leading-tight">
                                Add photos
                                <br />
                                <span className="text-[10px] text-gray-400">click or drop</span>
                              </span>
                            </div>
                          )}
                          {isUploading && (
                            <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white text-xs px-2">
                              <div className="w-[90%] bg-white/25 rounded-full h-1.5 mb-2 overflow-hidden">
                                <div
                                  className="bg-iregistrygreen h-1.5 rounded-full transition-all"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                              <span>
                                Uploading {currentUpload}/{totalUploads}
                              </span>
                              <button
                                type="button"
                                className="mt-2 text-[11px] underline text-white/90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelUpload();
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {!isUploading && photoRoom > 0 && (
                            <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/45 text-white text-[10px] text-center py-1 px-1">
                              {photosNormalized.length === 0 ? "Add up to 5 photos" : `${photoRoom} slot(s) left`}
                            </div>
                          )}
                        </div>

                        {(thumbPhotoUrls.length > 0 || photoRoom < MAX_PHOTOS) && (
                          <div className="w-full max-w-[22rem]">
                            {thumbPhotoUrls.length > 0 && (
                              <p className="text-[10px] text-gray-500 text-center mb-1">
                                Drag thumbnails to reorder · first = main
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 justify-center">
                              {thumbPhotoUrls.map((url, i) => (
                                <div
                                  key={`${url}-${i}`}
                                  draggable
                                  onDragStart={(e) => e.dataTransfer.setData("exIndex", String(i))}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    const from = Number(e.dataTransfer.getData("exIndex"));
                                    if (!Number.isNaN(from)) requestPhotoReorder(from, i);
                                  }}
                                  className="relative group"
                                >
                                  <button
                                    type="button"
                                    onClick={() => setPhotoIndex(i)}
                                    className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 block ${
                                      photoIndex === i
                                        ? "border-iregistrygreen ring-1 ring-iregistrygreen/30"
                                        : "border-gray-200 opacity-90 hover:opacity-100"
                                    }`}
                                  >
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                  </button>
                                  {i === 0 && (
                                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] bg-gray-800/85 text-white px-1 rounded whitespace-nowrap">
                                      Main
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    title="Remove photo"
                                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-[10px] leading-5 opacity-0 group-hover:opacity-100 transition shadow"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      requestPhotoRemove(i);
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {mainPhotoSrc ? (
                          <img
                            src={mainPhotoSrc}
                            alt={item.name || "Item photo"}
                            className="w-full max-w-[22rem] aspect-square object-cover rounded-2xl border border-gray-200"
                            onError={(e) => {
                              e.currentTarget.src = "";
                            }}
                          />
                        ) : (
                          <div className="w-full max-w-[22rem] aspect-square bg-gray-50 rounded-2xl border flex items-center justify-center text-gray-400">
                            <div className="text-4xl">☁</div>
                          </div>
                        )}
                        {thumbPhotoUrls.length > 1 && (
                          <div className="flex flex-wrap gap-2 justify-center max-w-[22rem]">
                            {thumbPhotoUrls.map((url, i) => (
                              <button
                                key={url + i}
                                type="button"
                                onClick={() => setPhotoIndex(i)}
                                className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 ${
                                  photoIndex === i
                                    ? "border-iregistrygreen ring-1 ring-iregistrygreen/30"
                                    : "border-gray-200 opacity-80 hover:opacity-100"
                                }`}
                              >
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Quick facts
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Make / Model</div>
                      <div className="mt-0.5 font-semibold text-gray-900 truncate">
                        {(item.make || "") + (item.model ? ` / ${item.model}` : "") || "—"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Value</div>
                      <div className="mt-0.5 font-semibold text-gray-900 truncate tabular-nums">
                        {formatBwpCurrency(item.estimatedValue ?? item.value)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Last seen</div>
                      <div className="mt-0.5 font-semibold text-gray-900 truncate">{item.lastSeen || "—"}</div>
                    </div>
                    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Purchased</div>
                      <div className="mt-0.5 font-semibold text-gray-900 truncate">{item.purchaseDate || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details + activity */}
              <div className="lg:col-span-7 space-y-4">
                {item.status === "Stolen" ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 shadow-sm p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-3">
                      Police recovery case
                    </div>
                    {policeCaseLoading ? (
                      <p className="text-sm text-slate-500">Loading police case…</p>
                    ) : policeCaseDetail ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-900">
                        <div className="rounded-2xl bg-white/70 border border-slate-100 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</div>
                          <div className="mt-0.5 font-semibold">{formatPoliceCaseStatusLabel(policeCaseDetail.status)}</div>
                        </div>
                        <div className="rounded-2xl bg-white/70 border border-slate-100 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Station</div>
                          <div className="mt-0.5 font-semibold">{policeCaseDetail.station || "—"}</div>
                        </div>
                        {policeCaseDetail.openedAt ? (
                          <div className="rounded-2xl bg-white/70 border border-slate-100 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Opened</div>
                            <div className="mt-0.5 font-semibold">{fmtDate(policeCaseDetail.openedAt)}</div>
                          </div>
                        ) : null}
                        {policeCaseDetail.clearedAt ? (
                          <div className="rounded-2xl bg-white/70 border border-slate-100 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cleared</div>
                            <div className="mt-0.5 font-semibold">{fmtDate(policeCaseDetail.clearedAt)}</div>
                          </div>
                        ) : null}
                        {policeCaseDetail.notes ? (
                          <div className="sm:col-span-2 rounded-2xl bg-white/70 border border-slate-100 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</div>
                            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{policeCaseDetail.notes}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : user ? (
                      <p className="text-sm text-slate-500">
                        No open police case on file, or you don&apos;t have access to case details.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Item details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Town/Village</div>
                      <div className="text-gray-900 font-medium">{item.village || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Ward/Street</div>
                      <div className="text-gray-900 font-medium">{item.ward || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Nearest police station</div>
                      <div className="text-gray-900 font-medium">{item.station || item.location || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Serial 2</div>
                      <div className="text-gray-900 font-medium">{item.serial2 || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Bought from (Shop)</div>
                      <div className="text-gray-900 font-medium">{item.shop || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Warranty expiry</div>
                      <div className="text-gray-900 font-medium">{item.warrantyExpiry || "—"}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-gray-500">Notes</div>
                      <div className="text-gray-900 whitespace-pre-wrap">{item.ownerInfo || item.notes || "—"}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-gray-500">Description</div>
                      <div className="text-gray-900 whitespace-pre-wrap">{item.description || "—"}</div>
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                      <div>
                        <div className="text-xs text-gray-500">Created</div>
                        <div className="text-gray-900 font-medium">{fmtDate(item.createdOn) || "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Updated</div>
                        <div className="text-gray-900 font-medium">{fmtDate(item.updatedOn) || "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Activity
                  </div>
                  <ItemActivityTimeline events={activity} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ConfirmModal (shared component) */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={closeDeleteModal}
        action={handleDeleteAction}
        // actionArg could be item.id if you prefer the modal to pass it
        actionArg={item?.id}
        afterConfirm={() => {
          /* performDelete already shows toast and navigates; keep extra safety */
          // no-op here (performDelete handles toast/navigation)
        }}
        title="Confirm delete"
        message={
          <>
            Are you sure you want to delete <span className="font-medium">{item.name || item.id}</span>? This action cannot be undone.
          </>
        }
        confirmLabel={working ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        danger={true}
      />

      {/* Admin transfer ownership modal */}
      <ConfirmModal
        isOpen={transferOpen}
        onClose={closeTransferOwnershipModal}
        onConfirm={() => void submitTransferOwnership()}
        title="Transfer ownership (admin)"
        message="Upload evidence and set the new owner user ID."
        confirmLabel={transferBusy ? "Transferring…" : "Transfer"}
        cancelLabel="Cancel"
        variant="warning"
        confirmDisabled={
          transferBusy ||
          !String(newOwnerId || "").trim() ||
          !evidenceFile ||
          !String(evidenceType || "").trim()
        }
      >
        <div className="space-y-3">
          {transferErr ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
              {transferErr}
            </div>
          ) : null}

          <div>
            <label className="text-xs text-gray-600">New owner</label>

            <input
              value={ownerQuery}
              onChange={(e) => {
                setOwnerQuery(e.target.value);
                setNewOwnerId("");
                setOwnerPickerOpen(true);
              }}
              onFocus={() => setOwnerPickerOpen(true)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Search by name, email, ID…"
              disabled={transferBusy || ownerUsersLoading}
            />

            <div className="text-[11px] text-gray-400 mt-1">
              {newOwnerId && selectedOwnerLabel
                ? `Selected: ${selectedOwnerLabel}`
                : "Type to search, then tap a result to select."}
            </div>

            {ownerPickerOpen && !transferBusy ? (
              <div className="mt-2 max-h-56 overflow-auto rounded-lg border bg-white shadow-sm">
                {ownerUsersLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading owners…</div>
                ) : filteredOwners.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No matches.</div>
                ) : (
                  <div className="divide-y">
                    {filteredOwners.slice(0, 50).map((u) => {
                      const name = `${String(u?.first_name || "").trim()} ${String(u?.last_name || "").trim()}`.trim();
                      const primary = name || u?.email || u?.id_number || u?.id;
                      const secondary = [u?.email, u?.id_number, u?.phone].filter(Boolean).join(" • ");
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          onClick={() => {
                            setNewOwnerId(String(u.id));
                            setOwnerQuery(primary);
                            setOwnerPickerOpen(false);
                          }}
                        >
                          <div className="text-sm text-gray-800 font-medium truncate">
                            {primary}
                          </div>
                          {secondary ? (
                            <div className="text-xs text-gray-500 truncate">{secondary}</div>
                          ) : null}
                        </button>
                      );
                    })}
                    {filteredOwners.length > 50 ? (
                      <div className="px-3 py-2 text-xs text-gray-400">
                        Showing 50 results. Keep typing to narrow down.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <label className="text-xs text-gray-600">Evidence type</label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
              disabled={transferBusy}
            >
              <option value="ADMIN_TRANSFER">Admin transfer</option>
              <option value="COURT_ORDER">Court order</option>
              <option value="POLICE_CLEARANCE">Police clearance</option>
              <option value="INVOICE_RECEIPT">Invoice / receipt</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600">Evidence file (PDF or image)</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              className="mt-1 w-full text-sm"
              disabled={transferBusy}
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
            />
            {evidenceFile ? (
              <div className="text-[11px] text-gray-500 mt-1 break-all">
                Selected: {evidenceFile.name} ({Math.round(evidenceFile.size / 1024)} KB)
              </div>
            ) : null}
          </div>
        </div>
      </ConfirmModal>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast({ visible: false, message: "", type: "info" })}
      />
    </div>
  );
}