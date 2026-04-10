// src/Pages/AddItem.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { formatBwpCurrency } from "../lib/formatBWP.js";
import { compressImage } from "../utils/imageCompression.js";

export default function AddItem() {
  const navigate = useNavigate();
  const { addItem, loading, items = [] } = useItems();
  const { user } = useAuth();
  const [serialError, setSerialError] = useState(null);
  const [serialCheckWarning, setSerialCheckWarning] = useState(null);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);
  const activeXhrs = useRef([]);
  const uploadCancelledRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);

  const [heldAtResidence, setHeldAtResidence] = useState(true);
  /** Raw digits while focused; formatted BWP string when blurred */
  const [estimatedValueFocused, setEstimatedValueFocused] = useState(false);

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
  });

  const latestSerial1Ref = useRef("");
  latestSerial1Ref.current = form.serial1;

  const { alert, confirm } = useModal();

  useEffect(() => {
    if (!heldAtResidence) return;
    setForm((f) => ({
      ...f,
      village: typeof user?.village === "string" && user.village.trim() ? user.village.trim() : f.village,
      ward: typeof user?.ward === "string" && user.ward.trim() ? user.ward.trim() : f.ward,
      station:
        typeof user?.police_station === "string" && user.police_station.trim()
          ? user.police_station.trim()
          : f.station,
    }));
  }, [heldAtResidence, user?.village, user?.ward, user?.police_station]);

  useEffect(() => {
    if (!form.serial1.trim()) {
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
            "Could not verify this serial number. You can still submit; duplicate serials will be rejected by the registry."
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
          "Could not verify this serial number. You can still submit; duplicate serials will be rejected by the registry."
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.serial1]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const categoryOptions = useMemo(() => {
    const s = new Set(
      (items || []).map((it) => (it?.category || "").trim()).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const makeOptions = useMemo(() => {
    const category = (form.category || "").trim();
    const subset = (items || []).filter((it) => {
      if (!it) return false;
      if (!category) return true;
      return String(it.category || "").trim() === category;
    });
    const s = new Set(subset.map((it) => (it?.make || "").trim()).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items, form.category]);

  const modelOptions = useMemo(() => {
    const category = (form.category || "").trim();
    const make = (form.make || "").trim();
    const subset = (items || []).filter((it) => {
      if (!it) return false;
      if (category && String(it.category || "").trim() !== category) return false;
      if (make && String(it.make || "").trim() !== make) return false;
      return true;
    });
    const s = new Set(subset.map((it) => (it?.model || "").trim()).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items, form.category, form.make]);

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

  const stationOptions = useMemo(() => {
    const s = new Set(
      (items || [])
        .map((it) => String(it?.station || it?.location || "").trim())
        .filter(Boolean)
    );
    const u = String(user?.police_station || "").trim();
    if (u) s.add(u);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items, user?.police_station]);

  function handleCategoryChange(next) {
    const v = String(next ?? "");
    setForm((f) => ({
      ...f,
      category: v,
      make: "", // reset dependent fields
      model: "",
    }));
  }

  function handleMakeChange(next) {
    const v = String(next ?? "");
    setForm((f) => ({
      ...f,
      make: v,
      model: "", // reset dependent field
    }));
  }

  function handleCurrencyChange(e) {
    let raw = e.target.value;

    // Remove everything except digits and decimal
    raw = raw.replace(/[^\d.]/g, "");

    // Prevent multiple decimals
    const parts = raw.split(".");
    if (parts.length > 2) {
      raw = parts[0] + "." + parts[1];
    }

    updateField("estimatedValue", raw);
  }

  async function processFiles(files) {
    const selected = Array.from(files).slice(0, 5);

    photoPreviews.forEach(p => URL.revokeObjectURL(p.url));

    const previews = await Promise.all(
      selected.map(async (file) => {

        const compressed = await compressImage(file);

        return {
          file: compressed,
          url: URL.createObjectURL(compressed),
        };

      })
    );

    setPhotoPreviews(previews);
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

  function movePhoto(fromIndex, toIndex) {

    const updated = [...photoPreviews];

    const [moved] = updated.splice(fromIndex, 1);

    updated.splice(toIndex, 0, moved);

    setPhotoPreviews(updated);
  }

  function removePhoto(index) {

    const updated = [...photoPreviews];

    URL.revokeObjectURL(updated[index].url);

    updated.splice(index, 1);

    setPhotoPreviews(updated);
  }

  const requiredFields = ["category", "make", "model", "serial1", "station"];

  function isFieldInvalid(field) {
    return requiredFields.includes(field) && !form[field]?.trim();
  }

  const isFormInvalid = loading || !!serialError || requiredFields.some(f => !form[f]?.trim());

  function cancelUpload() {
    uploadCancelledRef.current = true;

    activeXhrs.current.forEach(xhr => xhr.abort());
    activeXhrs.current = [];

    setIsUploading(false);
    setUploadProgress(0);
    setCurrentUpload(0);
    setTotalUploads(0);
  }

  function goToCreatedItem(slug) {
    if (slug) navigate(`/items/${slug}`);
    else navigate("/items");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (serialError) {
      await alert({
        title: "Serial Conflict",
        message: "Please resolve the serial number conflict before continuing.",
        variant: "error",
      });

      document.querySelector('input[name="serial1"]')?.focus();
      return;
    }

    if (!form.category.trim()) {
      await alert({
        title: "Missing Information",
        message: "Please fill in the Category field before you continue.",
        variant: "warning",
      });

      document.querySelector('input[name="category"]')?.focus();
      return;
    }

    if (!form.make.trim()) {
      await alert({
        title: "Missing Information",
        message: "Please fill in the Item Make before you continue.",
        variant: "warning",
      });

      document.querySelector('input[name="make"]')?.focus();
      return;
    }

    if (!form.model.trim()) {
      await alert({
        title: "Missing Information",
        message: "Please fill in the Item Model before you continue.",
        variant: "warning",
      });

      document.querySelector('input[name="model"]')?.focus();
      return;
    }
    
    if (!form.serial1.trim()) {
      await alert({
        title: "Missing Information",
        message: "Please fill in the Item's Primary Serial Number before you continue.",
        variant: "warning",
      });

      document.querySelector('input[name="serial1"]')?.focus();
      return;
    }
    
    if (!form.station.trim()) {
      await alert({
        title: "Missing Information",
        message: "Please fill in the Nearest police station field before you continue.",
        variant: "warning",
      });

      document.querySelector('input[name="station"]')?.focus();
      return;
    }
    
    let itemId;
    let itemSlug;

    try {
      const confirmed = await confirm({
        title: "Confirm",
        message: "Create this item now? This will create a new item record immediately.",
        confirmLabel: "Create item",
        cancelLabel: "Cancel",
      }).catch(() => false);
      if (!confirmed) return;

      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [
          k,
          typeof v === "string" ? v.trim() || undefined : v,
        ])
      );

      if (payload.estimatedValue) {
        payload.estimatedValue = Number(payload.estimatedValue);
      }

      // API: station required; village/ward optional (legacy `location` mirrored server-side)
      const created = await addItem(payload);

      itemId = created.id;
      itemSlug = created.slug;

      // If no photos selected, just redirect
      if (photoPreviews.length === 0) {
        goToCreatedItem(itemSlug);
        return;
      }

      // 1️⃣ Request signed upload URLs
      const { data: uploadInit, error: uploadError } =
        await invokeWithAuth("generate-upload-urls", {
          body: {
            itemId,
            files: photoPreviews.map(p => ({
              name: p.file.name,
              type: p.file.type,
              size: p.file.size,
            })),
          },
      });
      
      if (uploadError || !uploadInit?.success) {
        await alert({
          title: "Item Created",
          message:
            "The item was saved successfully, but photo upload failed. You can add photos later.",
          variant: "warning",
          mode: "alert",
        });

        goToCreatedItem(itemSlug);
        return;
      }

      // 2️⃣ Upload files to signed URLs
      uploadCancelledRef.current = false;
      setIsUploading(true);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(uploadInit.uploads.length);

      try {
        let completed = 0;
        const totalBytes = photoPreviews.reduce((sum, p) => sum + p.file.size, 0);
        let uploadedBytes = 0;

        await Promise.all(
          uploadInit.uploads.map((upload, i) => {
            const file = photoPreviews[i]?.file;

            if (!file) {
              throw new Error("Photo upload mismatch.");
            }

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
                activeXhrs.current = activeXhrs.current.filter(x => x !== xhr);

                if (xhr.status >= 200 && xhr.status < 300) {
                  completed++;
                  setCurrentUpload(completed);
                  resolve();
                } else {
                  reject(new Error("Failed to upload one of the photos."));
                }
              };

              xhr.onerror = () => {
                activeXhrs.current = activeXhrs.current.filter(x => x !== xhr);
                reject(new Error("Upload failed."));
              };

              xhr.send(file);
            });
          })
        );
      }finally{
        setIsUploading(false);
      }

      setUploadProgress(100);

      /* ---------- Generate thumbnails ---------- */

      await Promise.all(
        uploadInit.uploads.map(u =>
          invokeWithAuth("generate-thumbnail", {
            body: {
              originalPath: u.path,
              thumbPath: u.thumbPath
            }
          })
        )
      );

      // 3️⃣ Save photo paths in DB
      
      const { data: updateData, error: updateError } =
        await invokeWithAuth("update-item", {
          body: {
            id: itemId,
            updates: {
              photos: uploadInit.uploads.map(u => ({
                original: u.path,
                thumb: u.thumbPath
              }))
            },
          },
        });

      if (updateError || !updateData?.success) {
        throw new Error(
          updateData?.message || "Photos uploaded but failed to save references."
        );
      }

      /* ---------- Queue AI embedding ---------- */

      await Promise.all(
        uploadInit.uploads.map(u =>
          invokeWithAuth("create-embedding-job", {
            body: {
              itemId,
              photoPath: u.path,
              thumbPath: u.thumbPath
            }
          })
        )
      );

      await alert({
        title: "Item Created",
        message: "Your item has been successfully registered.",
        variant: "success",
        mode: "alert",
      });

      goToCreatedItem(itemSlug);

      setCurrentUpload(0);
      setTotalUploads(0);
      setUploadProgress(0);
      
    }     
    catch (err) {

      if (uploadCancelledRef.current) {
        await alert({
          title: "Upload Cancelled",
          message: "Photo upload was cancelled by the user.",
          variant: "warning",
        });

        goToCreatedItem(itemSlug);
        return;
      }

      await alert({
        title: "Failed to Add Item",
        message: err.message || "Something went wrong while processing this item.",
        variant: "error",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-iregistrygreen">
            Add New Item
          </h1>
          <p className="text-sm text-gray-500">
            Register a new item in your inventory
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 space-y-6"
        >

          {/* Category */}
          <Field label="Category" required>
            <input
              name="category"
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={`input ${isFieldInvalid("category") ? "border-red-500 ring-red-500" : ""}`}
              placeholder="Laptop, Television, Cellphone..."
              list="category-options"
            />
            <datalist id="category-options">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          {/* Make / Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Make" required>
              <input
                name="make"
                value={form.make}
                onChange={(e) => handleMakeChange(e.target.value)}
                className={`input ${isFieldInvalid("make") ? "border-red-500 ring-red-500" : ""}`}
                placeholder="HP, Samsung, Techno..."
                list="make-options"
                disabled={!form.category.trim() && categoryOptions.length > 0}
              />
              <datalist id="make-options">
                {makeOptions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {!form.category.trim() && categoryOptions.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Select a category first to filter makes.
                </p>
              )}
            </Field>

            <Field label="Model" required>
              <input
                name="model"
                value={form.model}
                onChange={(e) => updateField("model", e.target.value)}
                className={`input ${isFieldInvalid("model") ? "border-red-500 ring-red-500" : ""}`}
                placeholder="ProBook, 75 Inch QLED, Spark 4..."
                list="model-options"
                disabled={!form.make.trim() && makeOptions.length > 0}
              />
              <datalist id="model-options">
                {modelOptions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {!form.make.trim() && makeOptions.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Select a make first to filter models.
                </p>
              )}
            </Field>
          </div>

          {/* Serials */}
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

          {/* Where item is kept + nearest station */}
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
                  placeholder="e.g. Gantsi"
                  list="add-village-options"
                  disabled={heldAtResidence}
                />
                <datalist id="add-village-options">
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
                  placeholder="e.g. Ward 3"
                  list="add-ward-options"
                  disabled={heldAtResidence}
                />
                <datalist id="add-ward-options">
                  {wardOptions.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </div>
            </div>
            {heldAtResidence && (
              <p className="text-xs text-gray-500 mt-2">
                Town/Village and Ward/Street are taken from your profile. Uncheck to enter a different place.
              </p>
            )}
          </Field>

          <Field label="Nearest police station" required>
            <input
              name="station"
              value={form.station}
              onChange={(e) => updateField("station", e.target.value)}
              className={`input ${isFieldInvalid("station") ? "border-red-500 ring-red-500" : ""}`}
              placeholder="e.g. Gantsi Police Station"
              list="add-station-options"
            />
            <datalist id="add-station-options">
              {stationOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <Field label="Shop / retailer">
            <input
              name="shop"
              value={form.shop}
              onChange={(e) => updateField("shop", e.target.value)}
              className="input"
              placeholder="Store name (optional)"
            />
          </Field>

          {/* Purchase & Warranty Dates */}
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

          {/*Estimated Value*/}
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

          <div className="border-t pt-6 mt-6">
            {/* Notes */}
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="input h-24"
              />
            </Field>

            <Field label="Photos (max 5)">
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
                  id="photo-upload"
                />

                <label htmlFor="photo-upload" className="cursor-pointer block">

                  <div className="text-sm text-gray-600">
                    Drag photos here or
                    <span className="text-iregistrygreen font-medium"> click to browse</span>
                  </div>

                  <div className="text-xs text-gray-400 mt-1">
                    Maximum 5 images
                  </div>

                </label>

              </div>

              {photoPreviews.length > 0 && (

                <div className="grid grid-cols-3 gap-3 mt-3">

                  {photoPreviews.map((p, i) => (

                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("photoIndex", i);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const from = Number(e.dataTransfer.getData("photoIndex"));
                        movePhoto(from, i);
                      }}
                      className="relative group cursor-move"
                    >

                      <img
                        src={p.url}
                        alt="preview"
                        className="rounded-lg h-24 w-full object-cover border"
                      />

                      {/* Thumbnail badge */}

                      {i === 0 && (
                        <div className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">
                          Thumbnail
                        </div>
                      )}

                      {/* Delete button */}

                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
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

          {isUploading && (
            <div className="mb-4 space-y-3">

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-iregistrygreen h-2 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              {/* Text Below Bar */}
              <p className="text-xs text-gray-400 text-right tracking-wide">
                Uploading photo {currentUpload} of {totalUploads}...
              </p>

              {/* Cancel Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Cancel Upload
                </button>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <RippleButton
                type="button"
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => navigate("/items")}
              >
                Cancel
            </RippleButton>

            <RippleButton
              type="submit"
              disabled={isFormInvalid || isUploading}
              className="px-5 py-2 rounded-lg bg-iregistrygreen text-white"
            >
              {isUploading
                ? `Uploading ${currentUpload}/${totalUploads}`
                : loading
                ? "Saving..."
                : "Submit"}
            </RippleButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------ Helpers ------------------ */

function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && (
          <span className="text-red-600 ml-1">*</span>
        )}
      </label>
      {children}
    </div>
  );
}