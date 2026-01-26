// src/components/ConfirmModal.jsx
import React, { useEffect, useRef } from "react";

/**
 * Props:
 * - isOpen: boolean
 * - onClose(): required — called when modal closes (after confirm or cancel)
 * - onConfirm?: function — called when confirm (signature: () => void)
 * - action?: function — alternative to onConfirm; called with actionArg when provided
 * - actionArg?: any — optional argument passed to action()
 * - afterConfirm?: function — optional hook after confirm (runs before onClose)
 * - afterCancel?: function — optional hook after cancel (runs before onClose)
 * - title?: string
 * - message?: string | ReactNode
 * - confirmLabel?: string
 * - cancelLabel?: string
 * - danger?: boolean
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  actionArg,
  afterConfirm,
  afterCancel,
  title = "Confirm",
  message = "Are you sure?", // fallback message
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
}) {
  const confirmRef = useRef(null);

  // prevent background scroll when modal open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // keyboard shortcuts + focus management
  useEffect(() => {
    if (!isOpen) return;

    // focus confirm button when modal opens
    if (confirmRef.current) {
      confirmRef.current.focus();
    }

    function handleKey(e) {
      if (e.key === "Escape") {
        // cancel
        handleCancel();
      } else if (e.key === "Enter") {
        // confirm — ignore if a textarea or input inside modal is focused
        const active = document.activeElement;
        const isInput =
          active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        if (!isInput) handleConfirm();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // internal cancel handler: run hook then close
  function handleCancel() {
    try {
      if (typeof afterCancel === "function") afterCancel();
    } catch (err) {
      console.error("afterCancel error", err);
    } finally {
      onClose?.();
    }
  }

  // internal confirm handler: run action/onConfirm, then afterConfirm, then close
  function handleConfirm() {
    try {
      if (typeof action === "function") {
        action(actionArg);
      } else if (typeof onConfirm === "function") {
        onConfirm();
      }
      if (typeof afterConfirm === "function") afterConfirm();
    } catch (err) {
      console.error("confirm action error", err);
    } finally {
      onClose?.();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl shadow-lg max-w-sm w-full mx-4 p-6 z-10"
      >
        {title ? <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3> : null}

        {/* message accepts string or React node; always render fallback if falsy */}
        <div className="text-sm text-gray-600 mb-4">
          {message ?? "Are you sure?"}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg bg-white border"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            className={
              "px-4 py-2 rounded-lg text-white " +
              (danger ? "bg-red-600" : "bg-iregistrygreen")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}