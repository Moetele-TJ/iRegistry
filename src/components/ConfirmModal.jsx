// src/components/ConfirmModal.jsx
import React, { useEffect, useRef, useState } from "react";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  actionArg,
  afterConfirm,
  afterCancel,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  mode = "confirm",
  variant = "default",
}) {
  const confirmRef = useRef(null);
  const [loading, setLoading] = useState(false);

  /* ================= BODY SCROLL LOCK ================= */

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  /* ================= KEYBOARD HANDLING ================= */

  useEffect(() => {
    if (!isOpen) return;

    if (confirmRef.current) {
      confirmRef.current.focus();
    }

    function handleKey(e) {
      if (e.key === "Escape") {
        handleCancel();
      }

      if (e.key === "Enter") {
        const active = document.activeElement;
        const isInput =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);

        if (!isInput && !loading) handleConfirm();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  /* ================= ACTION HANDLERS ================= */

  async function handleConfirm() {
    if (loading) return;

    try {
      setLoading(true);

      if (mode === "confirm") {
        if (typeof action === "function") {
          await action(actionArg);
        } else if (typeof onConfirm === "function") {
          await onConfirm();
        }
      }

      if (typeof afterConfirm === "function") {
        await afterConfirm();
      }

      onClose?.();
    } catch (err) {
      console.error("confirm action error", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (loading) return;

    try {
      if (typeof afterCancel === "function") afterCancel();
    } catch (err) {
      console.error("afterCancel error", err);
    } finally {
      onClose?.();
    }
  }

  function getButtonColor() {
    if (danger || variant === "error") return "bg-red-600 hover:bg-red-700";
    if (variant === "success") return "bg-green-600 hover:bg-green-700";
    if (variant === "warning") return "bg-yellow-500 hover:bg-yellow-600";
    return "bg-iregistrygreen hover:opacity-90";
  }

  /* ================= UI ================= */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-xl shadow-md w-full max-w-xs sm:max-w-sm mx-4 p-5 max-h-[90vh] overflow-y-auto z-10"
      >
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </h3>
        )}

        <div className="text-sm text-gray-600 mb-4">
          {message}
        </div>

        <div className="flex justify-end gap-3">
          {/* Cancel button (confirm mode only) */}
          {mode === "confirm" && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-white border disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          )}

          {/* Confirm / OK button */}
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            className={
              "px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-60 " +
              getButtonColor()
            }
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Processing...
              </>
            ) : (
              mode === "alert" ? "OK" : confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}