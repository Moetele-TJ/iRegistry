// src/Pages/AddItem.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header.jsx";
import AddItemStep1 from "./AddItemStep1.jsx";
import AddItemStep2 from "./AddItemStep2.jsx";

import { useItems } from "../contexts/ItemsContext.jsx";

export default function AddItem() {
  const navigate = useNavigate();
  const { addItem } = useItems();

  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState({});
  const [step2Data, setStep2Data] = useState({});
  // keep initial combined object so Clear can restore initial (for add - initial is empty)
  const initialCombined = { ...step1Data, ...step2Data };

  function handleStep1Next(payload) {
    setStep1Data(payload);
    setStep(2);
  }

  async function handleStep2Submit(step2Payload) {
    // merge the two step payloads
    const final = { ...step1Data, ...step2Payload };

    // Build item shape consistent with app expectations (same shape ItemsContext.normalizeItem expects)
    // Note: ItemsContext will normalize further, so pass all fields here.
    const itemToStore = {
      // id omitted so provider will generate one
      name:
        final.make && final.model
          ? `${final.make} ${final.model}`
          : final.name || (final.category || "").trim() || undefined,
      category: final.category || "",
      make: final.make || "",
      model: final.model || "",
      status: final.status || "Active",
      lastSeen: final.purchaseDate || final.lastSeen || "",
      location: final.location || final.locationFound || "",
      serial1: final.serial1 || "",
      serial2: final.serial2 || "",
      ownerInfo: final.notes || final.ownerInfo || "",
      ownerId: final.ownerId || "",
      value: final.estimatedValue || final.value || "",
      shop: final.shop || "",
      warrantyExpiry: final.warrantyExpiry || "",
      imageUrl: final.imageUrl || "",
      photo: final.photo || null,
      description: final.description || "",
      // createdOn/updatedOn are handled by ItemsContext
      // include any leftover fields so provider has everything it might need
      ...final,
    };

    try {
      // addItem may be synchronous or async; handle both
      const res = addItem(itemToStore);
      let newId;
      if (res && typeof res.then === "function") {
        newId = await res;
      } else {
        newId = res;
      }

      // navigate to item details (or items list)
      if (newId) navigate("/items/" + newId);
      else navigate("/items");
    } catch (e) {
      // fallback: log and navigate to list
      console.error("Failed to add item:", e);
      navigate("/items");
    }
  }

  function handleCancel() {
    navigate("/items");
  }

  return (
    <div className="min-h-screen bg-gray-100">
  
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {step === 1 && (
          <AddItemStep1
            onNext={handleStep1Next}
            initial={step1Data}
            mode="add"
            onClear={() => {
              // reset step1 to initial empty
              setStep1Data({});
            }}
          />
        )}

        {step === 2 && (
          <AddItemStep2
            onBack={() => setStep(1)}
            onSubmit={handleStep2Submit}
            initial={{ ...initialCombined, ...step2Data }}
            mode="add"
            onClear={() => {
              // restore step2 fields to their initial values (empty)
              setStep2Data({});
            }}
          />
        )}

        <div className="mt-4 flex gap-2 justify-between">
          <button
            className="px-4 py-2 rounded border bg-white"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}