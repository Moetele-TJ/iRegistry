// src/Pages/AddItem.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import { useModal } from "../contexts/ModalContext.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

export default function AddItem() {
  const navigate = useNavigate();
  const { addItem, loading } = useItems();
  const [serialError, setSerialError] = useState(null);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [totalUploads, setTotalUploads] = useState(0);

  const [form, setForm] = useState({
    category: "",
    make: "",
    model: "",
    serial1: "",
    serial2: "",
    location: "",
    purchaseDate: "",
    estimatedValue: "",
    shop: "",
    warrantyExpiry: "",
    notes: "",
  });

  const { alert } = useModal();

  useEffect(() => {
    if (!form.serial1.trim()) return;

    const timer = setTimeout(async () => {
      try {

        const { data, error } = await invokeWithAuth("check-serial", {
          body: 
            { 
              serial1: form.serial1 
            },
        });

        if (error) {
          setSerialError(null);
          return;
        }

        if (data?.exists) {
          setSerialError("This serial number already exists.");
        } else {
          setSerialError(null);
        }
      } catch {
        setSerialError(null);
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

  function formatCurrency(value) {
    if (!value) return "";

    const number = Number(value);
    if (isNaN(number)) return "";

    return (
      "P " +
      number
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    );
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

  function handlePhotos(e) {
    const files = Array.from(e.target.files).slice(0, 5);

    // Clean previous previews
    photoPreviews.forEach(p => URL.revokeObjectURL(p.url));
    
    const previews = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setPhotoPreviews(previews);
  }

  const requiredFields = ["category", "make", "model", "serial1", "location"];

  function isFieldInvalid(field) {
    return requiredFields.includes(field) && !form[field]?.trim();
  }

  const isFormInvalid = loading || !!serialError || requiredFields.some(f => !form[f]?.trim());

  async function handleSubmit(e) {
    e.preventDefault();

    if (serialError) {
      await alert({
        title: "Serial Conflict",
        message: "Please resolve the serial number conflict before continuing.",
        variant: "error",
      });
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
    
    if (!form.location.trim()) {
      await alert({
        title: "Missing Information",
        message: "Please fill in the Location field before you continue.",
        variant: "warning",
      });

      document.querySelector('input[name="location"]')?.focus();
      return;
    }
    

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [
          k,
          typeof v === "string" ? v.trim() || undefined : v,
        ])
      );

      if (payload.estimatedValue) {
        payload.estimatedValue = Number(payload.estimatedValue);
      }

      const itemId = await addItem(payload);

      // If no photos selected, just redirect
      if (photoPreviews.length === 0) {
        navigate(`/items/${itemId}`);
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
        throw new Error(
          uploadInit?.message || "Failed to initialize photo upload."
        );
      }

      // 2️⃣ Upload files to signed URLs
      setIsUploading(true);
      setUploadProgress(0);
      setCurrentUpload(0);
      setTotalUploads(uploadInit.uploads.length);
      try {
        for (let i = 0; i < uploadInit.uploads.length; i++) {
          setCurrentUpload(i+1);

          const upload = uploadInit.uploads[i];
          const file = photoPreviews[i].file;

          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open("PUT", upload.signedUrl);
            xhr.setRequestHeader("Content-Type", file.type);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round(
                  ((i + event.loaded / event.total) / uploadInit.uploads.length) * 100
                );
                setUploadProgress(percent);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error("Failed to upload one of the photos."));
              }
            };

            xhr.onerror = () => reject(new Error("Upload failed."));
            xhr.send(file);
          });
        }
      }finally{
        setIsUploading(false);
      }

      setUploadProgress(100);

      // 3️⃣ Save photo paths in DB
      
      const { data: updateData, error: updateError } =
        await invokeWithAuth("update-item", {
          body: {
            id: itemId,
            updates: {
              photos: uploadInit.uploads.map(u => u.path),
            },
          },
        });

      if (updateError || !updateData?.success) {
        throw new Error(
          updateData?.message || "Photos uploaded but failed to save references."
        );
      }

      await alert({
        title: "Item Created",
        message: "Your item has been successfully registered.",
        variant: "success",
        mode: "alert",
      });

      navigate(`/items/${itemId}`);

      setCurrentUpload(0);
      setTotalUploads(0);
      
    }     
    catch (err) {
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
              onChange={(e) => updateField("category", e.target.value)}
              className={`input ${isFieldInvalid("category") ? "border-red-500 ring-red-500" : ""}`}
              placeholder="Laptop, Television, Cellphone..."
            />
          </Field>

          {/* Make / Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Make" required>
              <input
                name="make"
                value={form.make}
                onChange={(e) => updateField("make", e.target.value)}
                className={`input ${isFieldInvalid("make") ? "border-red-500 ring-red-500" : ""}`}
                placeholder="HP, Samsung, Techno..."
              />
            </Field>

            <Field label="Model" required>
              <input
                name="model"
                value={form.model}
                onChange={(e) => updateField("model", e.target.value)}
                className={`input ${isFieldInvalid("model") ? "border-red-500 ring-red-500" : ""}`}
                placeholder="ProBook, 75 Inch QLED, Spark 4..."
              />
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

          {/* Location */}
          <Field label="Location" required>
            <input
              name="location"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              className={`input ${isFieldInvalid("location") ? "border-red-500 ring-red-500" : ""}`}
              placeholder="Nearest Police Station..."
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
              value={formatCurrency(form.estimatedValue)}
              onChange={handleCurrencyChange}
              className="input"
              placeholder="P 0.00"
              inputMode="decimal"
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
              <input
                name="photos"
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotos}
                className="input"
              />

              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {photoPreviews.map((p, i) => (
                    <img
                      key={i}
                      src={p.url}
                      alt="preview"
                      className="rounded-lg h-24 w-full object-cover border"
                    />
                  ))}
                </div>
              )}
            </Field>
          </div>

          {isUploading && (
            <div className="mb-4">
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-iregistrygreen h-2 transition-all duration-300"
                  style={{
                    width: `${uploadProgress}%`,
                  }}
                />
              </div>

              {/* Text Below Bar */}
              <p className="text-xs text-gray-400 mt-2 text-right tracking-wide">
                Uploading photo {currentUpload || 1} of {totalUploads}...
              </p>
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