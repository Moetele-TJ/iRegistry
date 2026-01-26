// src/contexts/ToastContext.jsx
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ToastContext
 *
 * API:
 *  const { addToast, removeToast } = useToast();
 *
 *  addToast({
 *    type: "success" | "info" | "error",
 *    message: "Something happened",
 *    duration: 3000,            // optional ms; 0 = sticky until closed
 *    onClose: () => {}         // optional callback when toast closes
 *  });
 */

const ToastStateContext = createContext(null);
const ToastDispatchContext = createContext(null);

let idCounter = 1;
function genId() {
  idCounter += 1;
  return `toast_${Date.now().toString(36)}_${idCounter}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // addToast accepts either (message) or full object
  const addToast = useCallback((payload) => {
    const toast =
      typeof payload === "string"
        ? { id: genId(), type: "info", message: payload, duration: 3000 }
        : {
            id: payload.id || genId(),
            type: payload.type || "info",
            message: payload.message || "",
            duration:
              typeof payload.duration === "number" ? payload.duration : 3000,
            onClose: typeof payload.onClose === "function" ? payload.onClose : null,
          };

    setToasts((t) => [toast, ...t]);
    return toast.id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((t) => {
      const found = t.find((x) => x.id === id);
      if (found && typeof found.onClose === "function") {
        // call callback asynchronously to avoid render issues
        setTimeout(() => found.onClose(), 0);
      }
      return t.filter((x) => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => setToasts([]), []);

  return (
    <ToastStateContext.Provider value={toasts}>
      <ToastDispatchContext.Provider value={{ addToast, removeToast, clearAll }}>
        {children}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </ToastDispatchContext.Provider>
    </ToastStateContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastDispatchContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

/* ---------- ToastContainer + Toast item ---------- */

function ToastContainer({ toasts, removeToast }) {
  // make sure to render into body via portal when available
  const mount = typeof document !== "undefined" ? document.body : null;
  return mount
    ? createPortal(
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 items-end max-w-xs">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>,
        mount
      )
    : null;
}

function Toast({ toast, onClose }) {
  const { id, type, message, duration = 3000 } = toast;
  const timerRef = useRef(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (duration === 0) return; // sticky
    if (!hover) {
      timerRef.current = setTimeout(() => {
        onClose();
      }, duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [duration, hover, onClose]);

  // classes (uses CSS classes we added previously)
  const textClass =
    type === "success" ? "toast-success" : type === "error" ? "toast-error" : "toast-info";
  const bgClass =
    type === "success" ? "toast-success-bg" : type === "error" ? "toast-error-bg" : "toast-info-bg";

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => {
        setHover(true);
        clearTimeout(timerRef.current);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      className={`w-full flex items-start gap-3 p-3 rounded-lg shadow-md border border-gray-100 ${bgClass}`}
      style={{ minWidth: 260 }}
    >
      {/* icon */}
      <div className="flex-shrink-0 mt-0.5">
        {type === "success" ? (
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ color: "#1FA463" }}>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 01.083 1.32l-.083.094-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : type === "error" ? (
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ color: "#DC2626" }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 102 0V7zm0 6a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ color: "#3B82F6" }}>
            <path d="M2 10a8 8 0 1116 0A8 8 0 012 10z" />
          </svg>
        )}
      </div>

      {/* content */}
      <div className="flex-1 text-sm">
        <div className={`font-medium ${textClass}`}>{type?.toUpperCase()}</div>
        <div className="text-gray-700 mt-1 break-words">{message}</div>
      </div>

      {/* actions */}
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => onClose()}
          aria-label="Dismiss toast"
          className="px-2 py-1 text-xs rounded hover:bg-gray-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}