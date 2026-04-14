import { useCallback, useRef } from "react";

/**
 * Prepares the DOM for printing / Save as PDF: expands all <details> under `ref`,
 * then calls window.print(). Restores open state on afterprint (with timeout fallback).
 */
export function usePrintDocument() {
  const contentRef = useRef(null);

  const printAsPdf = useCallback(() => {
    const root = contentRef.current;
    if (!root || typeof window === "undefined") return;

    const details = [...root.querySelectorAll("details")];
    const wasOpen = details.map((d) => d.open);
    details.forEach((d) => {
      d.open = true;
    });

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      details.forEach((d, i) => {
        d.open = wasOpen[i];
      });
    };

    // `afterprint` fires when the print dialog closes (including Save as PDF). Avoid restoring
    // on a short timer — that can collapse FAQ <details> before the browser renders the PDF.
    const fallbackTimer = window.setTimeout(restore, 60_000);
    window.addEventListener(
      "afterprint",
      () => {
        window.clearTimeout(fallbackTimer);
        restore();
      },
      { once: true }
    );

    window.requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  return { contentRef, printAsPdf };
}
