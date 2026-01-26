// src/Pages/AddItemStep2.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";

/**
 * Props:
 * - onBack()
 * - onSubmit(payload)
 * - initial: object with initial values
 * - mode: "add" | "edit" (default "add")
 * - onClear(): optional handler (only visible in add mode)
 * - onDelete(): optional handler (only visible in edit mode)
 */
export default function AddItemStep2({
  onBack,
  onSubmit,
  initial = {},
  mode = "add",
  onClear,
  onDelete,
}) {
  const navigate = useNavigate();
  const isEdit = mode === "edit" || Boolean(initial?.id);

  // visible fields (Step 2)
  const [purchaseDate, setPurchaseDate] = useState(initial.purchaseDate || "");
  const [estimatedValue, setEstimatedValue] = useState(initial.estimatedValue || "");
  const [shop, setShop] = useState(initial.shop || ""); // Bought from (Shop)
  const [warrantyExpiry, setWarrantyExpiry] = useState(initial.warrantyExpiry || "");
  const [notes, setNotes] = useState(initial.notes || "");

  // invisible/system fields
  const [ownerId] = useState(initial.ownerId || ""); // hidden, not editable here
  const [status] = useState(initial.status || "Active");
  const [createdOn, setCreatedOn] = useState(initial.createdOn || "");
  const [updatedOn, setUpdatedOn] = useState(initial.updatedOn || "");

  function handleBack() {
    if (typeof onBack === "function") onBack();
    else navigate(-1);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const now = new Date().toISOString();
    const payload = {
      // visible Step2 fields
      purchaseDate,
      estimatedValue,
      shop,
      warrantyExpiry,
      notes,
      // invisible/system
      ownerId,
      status,
      createdOn: createdOn || now,
      updatedOn: now,
      // include any leftover initial fields so parent gets a complete object
      ...initial,
    };

    if (typeof onSubmit === "function") onSubmit(payload);
    else {
      // fallback behaviour
      console.log("Submit payload", payload);
      navigate("/items");
    }
  }

  function handleClear() {
    if (typeof onClear === "function") {
      onClear();
      return;
    }
    setPurchaseDate("");
    setEstimatedValue("");
    setShop("");
    setWarrantyExpiry("");
    setNotes("");
  }

  function handleDeleteClick() {
    if (typeof onDelete === "function") {
      onDelete();
      return;
    }
    if (!confirm("Delete this item? This action cannot be undone.")) return;
    navigate("/items");
  }

  const title = isEdit ? "Edit Item" : "Add New Item";

  return (
    <div className="flex justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-white rounded-2xl p-8 shadow-lg"
      >
        {/* Centered Title */}
        <div className="text-center mb-4">
          <h1 className="text-iregistrygreen text-2xl font-extrabold">{title}</h1>
          <p className="text-gray-500 text-sm">Step 2 of 2</p>
        </div>

        {/* Section heading row: left = Additional information, right = Clear/Delete */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Additional information</h2>

          <div>
            {!isEdit && (
              <RippleButton
                type="button"
                className="py-2 px-3 rounded-lg bg-white border text-gray-700 text-sm"
                onClick={handleClear}
              >
                Clear
              </RippleButton>
            )}

            {isEdit && (
              <RippleButton
                type="button"
                className="py-2 px-3 rounded-lg bg-red-600 text-white text-sm"
                onClick={handleDeleteClick}
              >
                Delete
              </RippleButton>
            )}
          </div>
        </div>

        {/* Purchase Date */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Purchase Date</span>
          <input
            name="purchaseDate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Estimated Value */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Estimated Value</span>
          <input
            name="estimatedValue"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="e.g. P2800.00"
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Bought from (Shop) */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Bought from (Shop)</span>
          <input
            name="shop"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="Shop or vendor name (optional)"
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Warranty expiry */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Warranty expiry</span>
          <input
            name="warrantyExpiry"
            type="date"
            value={warrantyExpiry}
            onChange={(e) => setWarrantyExpiry(e.target.value)}
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Notes (optional) */}
        <label className="block mb-6">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes or owner info"
            rows={3}
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Hidden/system fields (not shown) */}
        <input type="hidden" name="ownerId" value={ownerId} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="createdOn" value={createdOn} />
        <input type="hidden" name="updatedOn" value={updatedOn} />
        {Object.keys(initial || {}).map((k) => {
          // avoid duplicating keys we already include
          if (
            [
              "purchaseDate",
              "estimatedValue",
              "shop",
              "warrantyExpiry",
              "notes",
              "ownerId",
              "status",
              "createdOn",
              "updatedOn",
            ].includes(k)
          )
            return null;
          const val = initial[k];
          if (val == null) return null;
          if (typeof val === "object") return null;
          return <input type="hidden" name={k} value={String(val)} key={k} />;
        })}

        {/* Buttons (appearance identical to Step1) */}
        <div className="flex gap-4">
          <RippleButton
            type="button"
            className="flex-1 py-3 rounded-lg bg-iregistrygreen text-white font-semibold shadow-lg"
            onClick={handleBack}
          >
            Back
          </RippleButton>

          <RippleButton
            type="submit"
            className="flex-1 py-3 rounded-lg bg-iregistrygreen text-white font-semibold shadow-lg"
          >
            Save
          </RippleButton>
        </div>
      </form>
    </div>
  );
}