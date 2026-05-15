import { useEffect, useState } from "react";
import {
  PERMANENT_DELETE_CONFIRM_MESSAGE,
  SOFT_DELETE_CONFIRM_MESSAGE,
} from "../lib/itemLifecycleUx.js";

/**
 * Lets admin/cashier choose soft (recycle bin) vs permanent delete for another user's item.
 */
export default function PrivilegedItemDeleteModal({
  isOpen,
  onClose,
  itemName = "this item",
  ownerLabel = null,
  allowSoft = true,
  allowPermanent = true,
  loading = false,
  onConfirm,
}) {
  const defaultMode = allowSoft ? "soft" : "permanent";
  const [mode, setMode] = useState(defaultMode);

  useEffect(() => {
    if (isOpen) setMode(defaultMode);
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const canSubmit =
    !loading && ((mode === "soft" && allowSoft) || (mode === "permanent" && allowPermanent));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-delete-title"
        className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-5 z-10 border border-gray-100"
      >
        <h3 id="staff-delete-title" className="text-lg font-semibold text-gray-900">
          Delete item for user
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          <span className="font-medium text-gray-800">{itemName}</span>
          {ownerLabel ? (
            <>
              {" "}
              — owner: <span className="font-medium">{ownerLabel}</span>
            </>
          ) : null}
        </p>

        <div className="mt-4 space-y-3">
          {allowSoft ? (
            <label
              className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
                mode === "soft"
                  ? "border-emerald-300 bg-emerald-50/60"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="staff-delete-mode"
                value="soft"
                checked={mode === "soft"}
                onChange={() => setMode("soft")}
                className="mt-1"
                disabled={loading}
              />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">Move to recycle bin</span>
                <span className="block text-gray-600 mt-0.5">{SOFT_DELETE_CONFIRM_MESSAGE}</span>
              </span>
            </label>
          ) : null}

          {allowPermanent ? (
            <label
              className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition ${
                mode === "permanent"
                  ? "border-red-300 bg-red-50/50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="staff-delete-mode"
                value="permanent"
                checked={mode === "permanent"}
                onChange={() => setMode("permanent")}
                className="mt-1"
                disabled={loading}
              />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">Delete permanently</span>
                <span className="block text-gray-600 mt-0.5">{PERMANENT_DELETE_CONFIRM_MESSAGE}</span>
              </span>
            </label>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onConfirm(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
              mode === "permanent" ? "bg-red-700 hover:bg-red-800" : "bg-iregistrygreen hover:opacity-95"
            }`}
          >
            {loading
              ? "Working…"
              : mode === "permanent"
                ? "Delete permanently"
                : "Move to recycle bin"}
          </button>
        </div>
      </div>
    </div>
  );
}
