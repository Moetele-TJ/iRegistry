import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Full-screen image viewer with prev/next navigation.
 * @param {string[]} urls — full-size image URLs
 * @param {number} index — active index
 * @param {() => void} onClose
 * @param {(n: number) => void} onIndexChange
 */
export default function PhotoLightbox({ urls, index, onClose, onIndexChange }) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (list.length === 0) return null;

  const safeIndex = Math.min(Math.max(0, index), list.length - 1);
  const hasMultiple = list.length > 1;

  const goPrev = useCallback(() => {
    onIndexChange(safeIndex <= 0 ? list.length - 1 : safeIndex - 1);
  }, [safeIndex, list.length, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange(safeIndex >= list.length - 1 ? 0 : safeIndex + 1);
  }, [safeIndex, list.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white p-2 transition"
        onClick={onClose}
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {hasMultiple ? (
        <>
          <button
            type="button"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 hover:bg-white/25 text-white p-2 sm:p-3 transition"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={28} className="sm:w-8 sm:h-8" />
          </button>
          <button
            type="button"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 hover:bg-white/25 text-white p-2 sm:p-3 transition"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Next photo"
          >
            <ChevronRight size={28} className="sm:w-8 sm:h-8" />
          </button>
        </>
      ) : null}

      <img
        src={list[safeIndex]}
        alt=""
        className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {hasMultiple ? (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80 tabular-nums">
          {safeIndex + 1} / {list.length}
        </p>
      ) : null}
    </div>
  );
}
