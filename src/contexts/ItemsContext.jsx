//src/contexts/ItemsContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ===================================================== */
/* ===================== CONTEXTS ====================== */
/* ===================================================== */

const ItemsStateContext = createContext(null);
const ItemsDispatchContext = createContext(null);

/* ===================================================== */
/* ===================== REDUCER ======================= */
/* ===================================================== */

function itemsReducer(state, action) {

  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_ITEMS":
      return { ...state, items: action.payload || [] };

    default:
      return state;
  }
}

/* ===================================================== */
/* =============== DB → UI NORMALIZER ================== */
/* ===================================================== */

function normalizeFromDB(row) {
  return {
    id: row.id,
    ownerId: row.ownerid,

    name: row.name,
    category: row.category,
    make: row.make,
    model: row.model,

    serial1: row.serial1,
    serial2: row.serial2,

    location: row.location,
    lastSeen: row.lastseen,
    reportedStolenAt: row.reportedstolenat,

    photos: row.photos || [],

    purchaseDate: row.purchasedate,
    estimatedValue: row.estimatedvalue,
    shop: row.shop,
    warrantyExpiry: row.warrantyexpiry,
    notes: row.notes,

    createdOn: row.createdon,
    updatedOn: row.updatedon,
    deletedAt: row.deletedat,
  };
}

/* ===================================================== */
/* ===================== PROVIDER ====================== */
/* ===================================================== */

export function ItemsProvider({ children }) {
  const initialState = {
    items: [],
    loading: false,
    error: null,
  };

  const [state, dispatch] = useReducer(itemsReducer, initialState);
  const { user } = useAuth();

  /* ---------------- FETCH ITEMS ---------------- */
  
  async function refreshItems(filters = {}) {

    //Only block when there's no user and not explicitly allowed
    if (!user && !filters.allowUnauthenticated) {
      dispatch({ type: "SET_ITEMS", payload: [] });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const { data, error } = await supabase.functions.invoke(
        "get-items",
        {
          body: {
            ownerId: filters.ownerId,
            includeDeleted: filters.includeDeleted,
            category: filters.category,
            make: filters.make,
            model: filters.model,
            reportedStolen: filters.reportedStolen,
            hasPhotos: filters.hasPhotos,
            createdFrom: filters.createdFrom,
            createdTo: filters.createdTo,
            search: filters.search,
          },
        }
      );

      if (error || !data?.success) {
        throw new Error(data?.message || "Failed to load items");
      }

      dispatch({
        type: "SET_ITEMS",
        payload: (data.items || []).map(normalizeFromDB),
      });

    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Failed to load items",
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /* Initial load */
  useEffect(() => {
    if (!user?.id) {
      dispatch({ type: "SET_ITEMS", payload: [] });
      return;
    }

    refreshItems({ ownerId: user.id });
  }, [user?.id]);

  /* ---------------- ADD ITEM ---------------- */
  
  async function addItem(payload) {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const token = localStorage.getItem("session");

      const { data, error } = await supabase.functions.invoke("create-item", {
        body: payload,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.message || "Failed to create item");
      }

      await refreshItems();
      return data.item_id;

    }catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
      throw err; // optional, for caller handling
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /* ---------------- UPDATE ITEM ---------------- */
  
  async function updateItem(id, updates) {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const { error } = await supabase.functions.invoke(
        "update-item",
        { body: { id, updates } }
      );

      if (error) {
        throw new Error("Failed to update item");
      }

      await refreshItems();
    }catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
      throw err; // optional, for caller handling
    }finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /* ---------------- DELETE ITEM (SOFT) ---------------- */

  async function deleteItem(id) {
  
  dispatch({ type: "SET_LOADING", payload: true });
  dispatch({ type: "SET_ERROR", payload: null });

  try {
    const { error } = await supabase.functions.invoke(
      "delete-item",
      { body: { id } }
    );

    if (error) throw error;

    await refreshItems(); // ✅ always trust server

  } catch (err) {
    dispatch({ type: "SET_ERROR", payload: err.message });
    throw err;
  }finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
}

  /* ---------------- RESTORE ITEM ---------------- */

  async function restoreItem(id) {
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const { error } = await supabase.functions.invoke(
        "restore-item",
        { body: { id } }
      );

      if (error) throw error;

      await refreshItems({ includeDeleted: true });

    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Failed to restore item",
      });
      throw err;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /* ---------------- HARD DELETE ITEM ---------------- */
  async function hardDeleteItem(id) {

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const { error } = await supabase.functions.invoke(
        "hard-delete-item",
        { body: { id } }
      );

      if (error) throw error;

      // Always trust DB as source of truth
      await refreshItems({ includeDeleted: true });

    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Failed to permanently delete item",
      });
      throw err;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /*========================TRANANSFER OWNERSHIP=======================*/
  async function transferOwnership({ itemId, newOwnerId, evidence }) {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const { error } = await supabase.functions.invoke(
        "transfer-item-ownership",
        {
          body: {
            itemId,
            newOwnerId,
            evidence,
          },
        }
      );

      if (error) throw error;

      await refreshItems({ includeDeleted: true });

    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Ownership transfer failed",
      });
      throw err;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /* ===================================================== */

  return (
    <ItemsStateContext.Provider value={state}>
      <ItemsDispatchContext.Provider
        value={{
          refreshItems,
          addItem,
          updateItem,
          deleteItem,
          restoreItem,
          hardDeleteItem,
          transferOwnership,
        }}
      >
        {children}
      </ItemsDispatchContext.Provider>
    </ItemsStateContext.Provider>
  );
}

/* ===================================================== */
/* ===================== HOOK ========================== */
/* ===================================================== */

export function useItems() {
  const state = useContext(ItemsStateContext);
  const actions = useContext(ItemsDispatchContext);

  if (!state || !actions) {
    throw new Error("useItems must be used inside ItemsProvider");
  }

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,

    addItem: actions.addItem,
    updateItem: actions.updateItem,
    deleteItem: actions.deleteItem,
    refreshItems: actions.refreshItems,
    restoreItem: actions.restoreItem,
    hardDeleteItem: actions.hardDeleteItem,
    transferOwnership: actions.transferOwnership,
  };
}