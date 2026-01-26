// src/Pages/EditItem.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Header from "../components/Header.jsx";
import AddItemStep1 from "./AddItemStep1.jsx";
import AddItemStep2 from "./AddItemStep2.jsx";
import RippleButton from "../components/RippleButton.jsx";

import { useItems } from "../contexts/ItemsContext.jsx"; // optional - used if provider is mounted

const STORAGE_KEY = "ireg_items_v1";

function loadItemsFallback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveItemsFallback(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("ireg:items-updated"));
  } catch (e) {
    console.error("Failed to save items (fallback)", e);
  }
}

export default function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Try to access context (guarded)
  let ctx = null;
  try {
    ctx = useItems();
  } catch (e) {
    ctx = null;
  }
  const updateItemCtx = ctx ? ctx.updateItem : null;
  const deleteItemCtx = ctx ? ctx.deleteItem : null;
  const itemsCtx = ctx ? ctx.items : null;

  const [storedItem, setStoredItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState({});
  const [step2Data, setStep2Data] = useState({});

  // load item from context if available otherwise fallback to localStorage
  useEffect(() => {
    setLoading(true);

    let found = null;
    if (itemsCtx) {
      found = (itemsCtx || []).find((it) => String(it.id) === String(id));
    } else {
      const all = loadItemsFallback();
      found = all.find((it) => String(it.id) === String(id));
    }

    if (!found) {
      setStoredItem(null);
      setLoading(false);
      return;
    }

    setStoredItem(found);

    // initialize step data from stored item (safe fallbacks)
    const s1 = {
      category: found.category || "",
      make: found.make || "",
      model: found.model || "",
      serial1: found.serial1 || "",
      serial2: found.serial2 || "",
      photo: found.photo || null,
      location: found.location || "",
      id: found.id,
      name: found.name || "",
      ...found,
    };

    const s2 = {
      purchaseDate: found.purchaseDate || found.lastSeen || "",
      estimatedValue: found.value || found.estimatedValue || "",
      shop: found.shop || "",
      warrantyExpiry: found.warrantyExpiry || "",
      notes: found.notes || found.ownerInfo || "",
      ownerId: found.ownerId || "",
      status: found.status || "Active",
      createdOn: found.createdOn || "",
      updatedOn: found.updatedOn || "",
      imageUrl: found.imageUrl || "",
      description: found.description || "",
      ...found,
    };

    setStep1Data(s1);
    setStep2Data(s2);
    setLoading(false);
    setStep(1);
  }, [id, itemsCtx]);

  // next from step1
  function handleStep1Next(payload) {
    setStep1Data(payload);
    setStep(2);
  }

  // save from step2 - use context if available, otherwise fallback to localStorage
  async function handleStep2Submit(step2Payload) {
    const final = { ...step1Data, ...step2Payload };

    const timestamp = new Date().toISOString();
    const updated = {
      ...storedItem,
      ...final,
      name:
        final.make && final.model
          ? `${final.make} ${final.model}`
          : final.name || storedItem.name || "",
      lastSeen: final.purchaseDate || storedItem.lastSeen || "",
      location: final.location || storedItem.location || "",
      serial1: final.serial1 || storedItem.serial1 || "",
      serial2: final.serial2 || storedItem.serial2 || "",
      ownerInfo: final.notes || storedItem.ownerInfo || "",
      ownerId: final.ownerId || storedItem.ownerId || "",
      value: final.estimatedValue || storedItem.value || "",
      shop: final.shop || storedItem.shop || "",
      warrantyExpiry: final.warrantyExpiry || storedItem.warrantyExpiry || "",
      imageUrl: final.imageUrl || storedItem.imageUrl || "",
      photo: final.photo || storedItem.photo || null,
      description: final.description || storedItem.description || "",
      createdOn: storedItem.createdOn || timestamp,
      updatedOn: timestamp,
    };

    // try context update first
    try {
      if (typeof updateItemCtx === "function") {
        const maybePromise = updateItemCtx(updated.id, updated);
        if (maybePromise && typeof maybePromise.then === "function") {
          await maybePromise;
        }
        // context persists and broadcasts; navigate to details
        navigate("/items/" + updated.id);
        return;
      }
    } catch (e) {
      console.warn("items context update failed, falling back to local storage", e);
    }

    // fallback modify localStorage directly
    try {
      const all = loadItemsFallback();
      const next = all.map((it) => (String(it.id) === String(updated.id) ? updated : it));
      saveItemsFallback(next);
      navigate("/items/" + updated.id);
    } catch (e) {
      console.error("Failed to save updated item (fallback):", e);
      // keep user on edit page if save failed
      alert("Failed to save changes. See console for details.");
    }
  }

  // delete - use context if available otherwise fallback
  async function handleDelete() {
    if (!confirm("Delete this item? This action cannot be undone.")) return;

    try {
      if (typeof deleteItemCtx === "function") {
        const maybePromise = deleteItemCtx(storedItem.id);
        if (maybePromise && typeof maybePromise.then === "function") {
          await maybePromise;
        }
        navigate("/items");
        return;
      }
    } catch (e) {
      console.warn("items context delete failed, falling back to local storage", e);
    }

    try {
      const all = loadItemsFallback();
      const filtered = all.filter((it) => String(it.id) !== String(id));
      saveItemsFallback(filtered);
      navigate("/items");
    } catch (e) {
      console.error("Failed to delete item (fallback):", e);
      alert("Failed to delete item. See console for details.");
    }
  }

  // restore step data to storedItem values
  function handleClearToInitial(whichStep) {
    if (!storedItem) return;
    if (whichStep === 1) {
      setStep1Data({
        category: storedItem.category || "",
        make: storedItem.make || "",
        model: storedItem.model || "",
        serial1: storedItem.serial1 || "",
        serial2: storedItem.serial2 || "",
        photo: storedItem.photo || null,
        location: storedItem.location || "",
        id: storedItem.id,
        name: storedItem.name || "",
      });
    } else {
      setStep2Data({
        purchaseDate: storedItem.purchaseDate || storedItem.lastSeen || "",
        estimatedValue: storedItem.value || "",
        shop: storedItem.shop || "",
        warrantyExpiry: storedItem.warrantyExpiry || "",
        notes: storedItem.notes || storedItem.ownerInfo || "",
        ownerId: storedItem.ownerId || "",
        status: storedItem.status || "Active",
        createdOn: storedItem.createdOn || "",
        updatedOn: storedItem.updatedOn || "",
        imageUrl: storedItem.imageUrl || "",
        description: storedItem.description || "",
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">Loading item...</div>
        </div>
      </div>
    );
  }

  if (!storedItem) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
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
      <Header />
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {step === 1 && (
          <AddItemStep1
            onNext={handleStep1Next}
            initial={step1Data}
            mode="edit"
            onDelete={handleDelete}
            onClear={() => handleClearToInitial(1)}
          />
        )}

        {step === 2 && (
          <AddItemStep2
            onBack={() => setStep(1)}
            onSubmit={handleStep2Submit}
            initial={{ ...step2Data }}
            mode="edit"
            onDelete={handleDelete}
            onClear={() => handleClearToInitial(2)}
          />
        )}
      </div>
    </div>
  );
}