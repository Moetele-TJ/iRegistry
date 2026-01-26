// src/Pages/AddItemStep1.jsx
import React, { useState } from "react";
import RippleButton from "../components/RippleButton.jsx";
import { useNavigate } from "react-router-dom";

/**
 * Props:
 * - onNext(payload)
 * - initial: object with initial values
 * - mode: "add" | "edit"  (default "add")
 * - onClear(): optional handler invoked when Clear button pressed (only in add mode)
 * - onDelete(): optional handler invoked when Delete pressed (only in edit mode)
 */
export default function AddItemStep1({ onNext, initial = {}, mode = "add", onClear, onDelete }) {
  const navigate = useNavigate();
  const isEdit = mode === "edit" || Boolean(initial?.id);

  const [category, setCategory] = useState(initial.category || "");
  const [make, setMake] = useState(initial.make || "");
  const [model, setModel] = useState(initial.model || "");
  const [serial1, setSerial1] = useState(initial.serial1 || "");
  const [serial2, setSerial2] = useState(initial.serial2 || "");
  const [photo, setPhoto] = useState(initial.photo || null);
  const [location, setLocation] = useState(initial.location || ""); // location between serial2 and photo

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      category,
      make,
      model,
      serial1,
      serial2,
      photo,
      location,
      ...initial, // keep other initial fields
    };
    if (typeof onNext === "function") onNext(payload);
    else navigate("/items/add");
  }

  function handleClear() {
    if (typeof onClear === "function") {
      onClear();
      return;
    }
    setCategory("");
    setMake("");
    setModel("");
    setSerial1("");
    setSerial2("");
    setPhoto(null);
    setLocation("");
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
          {/* always show step count under the title */}
          <p className="text-gray-500 text-sm">Step 1 of 2</p>
        </div>

        {/* Section heading row: left = Item Information, right = Clear/Delete */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Item Information</h2>

          <div>
            {/* Clear on add mode */}
            {!isEdit && (
              <RippleButton
                type="button"
                className="py-2 px-3 rounded-lg bg-white border text-gray-700 text-sm"
                onClick={handleClear}
              >
                Clear
              </RippleButton>
            )}

            {/* Delete on edit mode */}
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

        {/* Category */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full border rounded-lg px-4 py-3"
          >
            <option value="">Select category</option>
            <option value="Phone">Phone</option>
            <option value="Laptop">Laptop</option>
            <option value="TV">TV</option>
            <option value="Bicycle">Bicycle</option>
          </select>
        </label>

        {/* Make */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Make</span>
          <select
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel("");
            }}
            className="mt-2 w-full border rounded-lg px-4 py-3"
          >
            <option value="">Select make</option>
            <option value="Samsung">Samsung</option>
            <option value="Apple">Apple</option>
            <option value="HP">HP</option>
            <option value="Sony">Sony</option>
          </select>
        </label>

        {/* Model */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!make}
            className="mt-2 w-full border rounded-lg px-4 py-3 disabled:bg-gray-100"
          >
            <option value="">Select model</option>
            {make === "Samsung" && (
              <>
                <option value="A30">A30</option>
                <option value="S22">S22</option>
              </>
            )}
            {make === "Apple" && (
              <>
                <option value="iPhone 11">iPhone 11</option>
                <option value="iPhone 12">iPhone 12</option>
              </>
            )}
            {make === "HP" && (
              <>
                <option value="ProBook 450">ProBook 450</option>
                <option value="EliteBook 840">EliteBook 840</option>
              </>
            )}
          </select>
        </label>

        {/* Serial Number 1 */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">
            Serial Number 1
          </span>
          <input
            value={serial1}
            onChange={(e) => setSerial1(e.target.value)}
            placeholder="Enter primary serial"
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Serial Number 2 */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">
            Serial Number 2 (Optional)
          </span>
          <input
            value={serial2}
            onChange={(e) => setSerial2(e.target.value)}
            placeholder="Enter secondary serial"
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Location (moved here) */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">Location</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Where was this item seen or kept?"
            className="mt-2 w-full border rounded-lg px-4 py-3"
          />
        </label>

        {/* Photo */}
        <label className="block mb-6">
          <span className="text-sm font-medium text-gray-700">Item Photo</span>
          <div className="mt-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer shadow-lg">
            <input
              id="item-photo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files[0])}
            />
            <label htmlFor="item-photo" className="cursor-pointer">
              <div className="text-gray-400 text-3xl">☁</div>
              <div className="text-iregistrygreen font-semibold">Upload</div>
              <div className="text-gray-400 text-sm">Choose file</div>
            </label>
            {photo && <p className="mt-2 text-gray-600 text-sm">{photo.name}</p>}
          </div>
        </label>

        {/* Buttons */}
        <div className="flex gap-4">
          <RippleButton
            type="button"
            className="flex-1 py-3 rounded-lg bg-iregistrygreen text-white font-semibold shadow-lg"
            onClick={() => navigate("/dashboard")}
          >
            Back
          </RippleButton>

          <RippleButton
            type="submit"
            className="flex-1 py-3 rounded-lg bg-iregistrygreen text-white font-semibold shadow-lg"
          >
            Next
          </RippleButton>
        </div>
      </form>
    </div>
  );
}