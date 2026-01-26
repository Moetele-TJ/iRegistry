// src/contexts/ItemsContext.jsx
import React, { createContext, useContext, useEffect, useReducer } from "react";
import { localStorageService } from "../services/localStorageService.js";

// Fallback example data
const FALLBACK = [
  {
    id: "IR-0001",
    name: "Samsung Galaxy A30",
    category: "Phone",
    make: "Samsung",
    model: "A30",
    status: "Active",
    lastSeen: "2025-02-11",
    location: "Home",
    serial1: "SN-A30-12345",
    createdOn: "2025-02-11T08:00:00Z",
    updatedOn: "2025-02-11T08:00:00Z",
  },
  {
    id: "IR-0002",
    name: "HP ProBook 450",
    category: "Laptop",
    make: "HP",
    model: "ProBook 450",
    status: "Stolen",
    lastSeen: "2025-02-09",
    location: "Office",
    serial1: "HP-450-99999",
    createdOn: "2025-02-09T10:00:00Z",
    updatedOn: "2025-02-09T11:00:00Z",
  },
];

// CONTEXTS
const ItemsStateContext = createContext(null);
const ItemsDispatchContext = createContext(null);

// --- ID GENERATOR (IR-#### style)
function generateId() {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `IR-${String(num).padStart(4, "0")}`;
}

function nowISO() {
  return new Date().toISOString();
}

// --- REDUCER ---
function itemsReducer(state, action) {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.payload || [] };

    case "ADD_ITEM": {
      const newItem = action.payload;
      return { ...state, items: [newItem, ...(state.items || [])] };
    }

    case "UPDATE_ITEM": {
      const { id, updates } = action.payload;
      const items = (state.items || []).map((it) =>
        it.id === id ? { ...it, ...updates, updatedOn: nowISO() } : it
      );
      return { ...state, items };
    }

    case "DELETE_ITEM": {
      const id = action.payload.id;
      const items = (state.items || []).filter((it) => it.id !== id);
      return { ...state, items };
    }

    default:
      return state;
  }
}

// --- PROVIDER ---
export function ItemsProvider({ children }) {
  const initial = {
    items: localStorageService.loadItems() || FALLBACK,
  };

  const [state, dispatch] = useReducer(itemsReducer, initial);

  // Persist to storage whenever items change
  useEffect(() => {
    localStorageService.saveItems(state.items || []);
  }, [state.items]);

  return (
    <ItemsStateContext.Provider value={state}>
      <ItemsDispatchContext.Provider value={dispatch}>
        {children}
      </ItemsDispatchContext.Provider>
    </ItemsStateContext.Provider>
  );
}

// --- HOOKS / PUBLIC API ---
export function useItems() {
  const state = useContext(ItemsStateContext);
  const dispatch = useContext(ItemsDispatchContext);

  if (!state || !dispatch) {
    throw new Error("useItems must be used inside an ItemsProvider");
  }

  const items = state.items || [];

  // Normalize a final clean item object for saving/updating
  function normalizeItem(form, existing = {}) {
    return {
      id: existing.id || form.id || generateId(),

      // Name logic: make + model OR provided name OR category OR untitled
      name:
        form.make && form.model
          ? `${form.make} ${form.model}`
          : form.name || existing.name || form.category || "Untitled",

      category: form.category ?? existing.category ?? "",
      make: form.make ?? existing.make ?? "",
      model: form.model ?? existing.model ?? "",

      status: form.status ?? existing.status ?? "Active",

      lastSeen:
        form.lastSeen ??
        form.purchaseDate ??
        existing.lastSeen ??
        "",

      location:
        form.location ??
        form.locationFound ??
        existing.location ??
        "",

      serial1: form.serial1 ?? existing.serial1 ?? "",
      serial2: form.serial2 ?? existing.serial2 ?? "",

      ownerInfo:
        form.ownerInfo ??
        form.notes ??
        existing.ownerInfo ??
        "",

      ownerId: form.ownerId ?? existing.ownerId ?? "",

      value:
        form.estimatedValue ??
        form.value ??
        existing.value ??
        "",

      shop: form.shop ?? existing.shop ?? "",
      warrantyExpiry: form.warrantyExpiry ?? existing.warrantyExpiry ?? "",
      imageUrl: form.imageUrl ?? existing.imageUrl ?? "",
      description: form.description ?? existing.description ?? "",
      photo: form.photo ?? existing.photo ?? null,

      createdOn: existing.createdOn || nowISO(),
      updatedOn: nowISO(),
    };
  }

  // --- ADD ITEM (synchronous)
  function addItem(form) {
    const item = normalizeItem(form);
    dispatch({ type: "ADD_ITEM", payload: item });

    // broadcast update for other non-context consumers
    try {
      window.dispatchEvent(new Event("ireg:items-updated"));
    } catch (e) {
      // ignore
    }

    return item.id;
  }

  // --- UPDATE ITEM (synchronous)
  function updateItem(id, updates) {
    // Normalize updates based on existing item
    const existing = items.find((i) => i.id === id) || {};
    const updated = normalizeItem(updates, existing);

    // We'll dispatch the updates payload (reducer will merge)
    dispatch({ type: "UPDATE_ITEM", payload: { id, updates: updated } });

    try {
      window.dispatchEvent(new Event("ireg:items-updated"));
    } catch (e) {
      // ignore
    }

    return updated;
  }

  // --- DELETE ITEM (synchronous)
  function deleteItem(id) {
    dispatch({ type: "DELETE_ITEM", payload: { id } });

    try {
      window.dispatchEvent(new Event("ireg:items-updated"));
    } catch (e) {
      // ignore
    }

    return true;
  }

  // --- TOGGLE STATUS (synchronous wrapper)
  function toggleStatus(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return null;
    const next = it.status === "Stolen" ? "Active" : "Stolen";
    return updateItem(id, { status: next });
  }

  return {
    items,
    addItem,
    updateItem,
    deleteItem,
    toggleStatus,
    dispatch,
    state,
  };
}