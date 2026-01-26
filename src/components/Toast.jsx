// src/components/Toast.jsx
import React, { useEffect } from "react";

/**
 * Props:
 * - message: string
 * - type: "info" | "success" | "error" (controls color)
 * - onClose(): called when toast hides
 * - duration: ms (optional, default 3000)
 */
export default function Toast({ message = "", type = "info", onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const base = "fixed right-4 bottom-6 z-50 px-4 py-2 rounded-md shadow-lg text-sm";
  const kinds = {
    info: "bg-gray-900 text-white",
    success: "bg-iregistrygreen text-white",
    error: "bg-red-600 text-white",
  };

  return <div className={`${base} ${kinds[type] || kinds.info}`}>{message}</div>;
}