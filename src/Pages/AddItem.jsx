// src/Pages/AddItem.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import Toast from "../components/Toast.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { supabase } from "../lib/supabase.js";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

export default function AddItem() {
  const navigate = useNavigate();
  const { addItem, loading } = useItems();
  const [serialError, setSerialError] = useState(null);
  const [photoPreviews, setPhotoPreviews] = useState([]);

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

  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error",
  });

  useEffect(() => {
    if (!form.serial1.trim()) return;

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem("session");

        const { data, error } = await supabase.functions.invoke("check-serial", {
          body: { serial1: form.serial1 },

          headers: {
            Authorization: `Bearer ${token}`,
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
    }, 2000);

    return () => clearTimeout(timer);
  }, [form.serial1]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  useEffect(() => {
    if (!toast.visible) return;

    const timer = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, [toast.visible,toast.message]);

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
      setToast({
        visible: true,
        type: "error",
        message: "Please resolve the serial number conflict before continuing.",
      });
      return;
    }

    if (!form.category) {
      setToast({
        visible: true,
        type: "error",
        message: "Please fill in the Category field before you continue.",
      });
      return;
    }

    if (!form.make) {
      setToast({
        visible: true,
        type: "error",
        message: "Please fill in the Item Make before you continue.",
      });
      return;
    }

    if (!form.model) {
      setToast({
        visible: true,
        type: "error",
        message: "Please fill in the Item Model before you continue.",
      });
      return;
    }

    if (!form.serial1) {
      setToast({
        visible: true,
        type: "error",
        message: "Please fill in the Item's Primary Serial Number before you continue.",
      });
      return;
    }

    if (!form.location) {
      setToast({
        visible: true,
        type: "error",
        message: "Please fill in the Location field before you continue.",
      });
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
      const token = localStorage.getItem("session");

      if (!token) {
        throw new Error("Session expired. Please log in again.");
      }

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
      for (let i = 0; i < uploadInit.uploads.length; i++) {
        const upload = uploadInit.uploads[i];
        const file = photoPreviews[i].file;

        const response = await fetch(upload.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if(!response.ok){
          throw new Error("Failed to upload one of the photos.");
        }
      }

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

      navigate(`/items/${itemId}`);


    } catch (err) {
      setToast({
        visible: true,
        type: "error",
        message: err.message || "Failed to add item",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />

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
                value={form.make}
                onChange={(e) => updateField("make", e.target.value)}
                className={`input ${isFieldInvalid("make") ? "border-red-500 ring-red-500" : ""}`}
                placeholder="HP, Samsung, Techno..."
              />
            </Field>

            <Field label="Model" required>
              <input
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
                value={form.serial2}
                onChange={(e) => updateField("serial2", e.target.value)}
                className="input"
              />
            </Field>
          </div>

          {/* Location */}
          <Field label="Location" required>
            <input
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
                type="date"
                value={form.purchaseDate}
                onChange={(e) => updateField("purchaseDate", e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Warranty expiry">
              <input
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
              disabled={isFormInvalid}
              className="px-5 py-2 rounded-lg bg-iregistrygreen text-white"
            >
              {loading ? "Saving..." : "Submit"}
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