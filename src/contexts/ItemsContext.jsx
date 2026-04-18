//src/contexts/ItemsContext.jsx
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { attachBillingToError } from "../lib/billingUx.js";
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
} from "react";
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

    case "ADD_ITEM":
      return {
        ...state,
        items: [action.payload, ...state.items],
      };

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter(
          (item) => item.id !== action.payload
        ),
      };

    case "REPLACE_ITEM": {
      const next = action.payload;
      const idx = state.items.findIndex((item) => item.id === next.id);
      if (idx === -1) {
        return { ...state, items: [next, ...state.items] };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === next.id ? next : item
        ),
      };
    }

    default:
      return state;
  }
}

/* ===================================================== */
/* =============== DB → UI NORMALIZER ================== */
/* ===================================================== */

function normalizePoliceCase(pc) {
  if (!pc || typeof pc !== "object") return null;
  return {
    id: pc.id,
    itemId: pc.item_id,
    status: pc.status,
    station: pc.station,
    stationSource: pc.station_source,
    openedAt: pc.opened_at,
    clearedAt: pc.cleared_at,
    returnedAt: pc.returned_at,
    notes: pc.notes,
    evidence: pc.evidence ?? null,
  };
}

export function normalizeItemFromDB(row) {
  return {
    id: row.id,
    ownerId: row.ownerid,
    ownerOrgId: row.owner_org_id ?? null,
    ownerOrgSlug: row.owner_org_slug ?? null,
    assignedUserId: row.assigned_user_id ?? null,
    orgAssignedAt: row.org_assigned_at ?? null,
    orgAssignedBy: row.org_assigned_by ?? null,

    name: row.name,
    category: row.category,
    make: row.make,
    model: row.model,

    serial1: row.serial1,
    serial2: row.serial2,
    slug: row.slug,

    // New location split
    village: row.village ?? null,
    ward: row.ward ?? null,
    station: row.station ?? null,
    // Legacy: keep `location` mapped for older UI bits (treated as station historically).
    location: row.location ?? row.station ?? null,
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
    legacyAt: row.legacyat ?? null,
    legacyReason: row.legacy_reason ?? null,
    legacyBy: row.legacy_by ?? null,

    policeCase: normalizePoliceCase(row.police_case),

    createdBy: row.created_by ?? row.createdby ?? null,

    ownerRole: row.owner_role ?? null,
    ownerCreditBalance:
      typeof row.owner_credit_balance === "number"
        ? row.owner_credit_balance
        : null,
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

  const refreshItems = useCallback(
    async function refreshItems(filters = {}) {
      if (!user?.id) {
        dispatch({ type: "SET_ITEMS", payload: [] });
        return;
      }

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const { data, error } = await invokeWithAuth("get-items", {
          body: {
            ownerId: filters.ownerId ?? user.id,
            policeStationStolenView: filters.policeStationStolenView,
            includeDeleted: filters.includeDeleted,
            deletedOnly: filters.deletedOnly,
            includeLegacy: filters.includeLegacy,
            legacyOnly: filters.legacyOnly,
            category: filters.category,
            make: filters.make,
            model: filters.model,
            reportedStolen: filters.reportedStolen,
            hasPhotos: filters.hasPhotos,
            createdFrom: filters.createdFrom,
            createdTo: filters.createdTo,
            search: filters.search,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.message || "Failed to load items");
        }

        dispatch({
          type: "SET_ITEMS",
          payload: (data.items || []).map(normalizeItemFromDB),
        });
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          payload: err.message || "Failed to load items",
        });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [user?.id]
  );

  /* Clear list when logged out / user changes. Do not auto-fetch active items here — it races
     `Items` (deleted/legacy/active) on hard reload and the slower request could overwrite the
     correct tab. Item list loads from `Items.jsx` (and other callers) via `refreshItems`. */
  useEffect(() => {
    if (!user?.id) {
      dispatch({ type: "SET_ITEMS", payload: [] });
    }
  }, [user?.id]);

  /* ---------------- ADD ITEM ---------------- */
  
  async function addItem(payload) {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {

      const { data, error } = await invokeWithAuth("create-item", {
        body: payload,
      });

      if (error) {
        throw attachBillingToError(new Error(error.message || "Network error"), data);
      }

      if (!data?.success) {
        throw attachBillingToError(
          new Error(data?.message || "Failed to create item"),
          data
        );
      }
      
      const newItem = normalizeItemFromDB(data.item);
      dispatch({
        type: "ADD_ITEM",
        payload: newItem,
      });

      return {
        id: newItem.id,
        slug: newItem.slug
      };

    }catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
      throw err; // optional, for caller handling
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  /* ---------------- UPDATE ITEM ---------------- */
  
  async function updateItem(id, updates, extra = {}) {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const { data, error } = await invokeWithAuth(
      "update-item",
      { body: { id, updates, ...extra } }
    );

    if (error || !data?.success) {
      throw attachBillingToError(
        new Error(data?.message || error?.message || "Failed to update item"),
        data
      );
    }

    if (data.item) {
      const updatedItem = normalizeItemFromDB(data.item);

      dispatch({
        type: "REPLACE_ITEM",
        payload: updatedItem,
      });

      return updatedItem;
    }

    return null;

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
    const { data, error } = await invokeWithAuth(
      "delete-item",
      { body: { id } }
    );

    if (error) {
      throw new Error(error.message || "Network error");
    }

    if (!data?.success) {
      throw new Error(data?.message || "Failed to delete item");
    }

    dispatch({
      type: "REMOVE_ITEM",
      payload: id,
    });

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
      const { error } = await invokeWithAuth(
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

  /* ---------------- LEGACY (OBSOLETE) ---------------- */

  async function markLegacyItem(id, { reason = null } = {}) {
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const { data, error } = await invokeWithAuth("mark-item-legacy", {
        body: { id, reason },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to move item to legacy");
      }
      await refreshItems({ includeLegacy: true });
      return true;
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message || "Failed to move item to legacy" });
      throw err;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }

  async function restoreLegacyItem(id) {
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const { data, error } = await invokeWithAuth("restore-legacy-item", {
        body: { id },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to restore legacy item");
      }
      await refreshItems({ includeLegacy: true });
      return true;
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message || "Failed to restore legacy item" });
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
      const { error } = await invokeWithAuth(
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
      const { error } = await invokeWithAuth(
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
          markLegacyItem,
          restoreLegacyItem,
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
    markLegacyItem: actions.markLegacyItem,
    restoreLegacyItem: actions.restoreLegacyItem,
    hardDeleteItem: actions.hardDeleteItem,
    transferOwnership: actions.transferOwnership,
  };
}