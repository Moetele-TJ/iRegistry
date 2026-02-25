// src/components/Tooltip.jsx
import { useState, useRef, useEffect, useLayoutEffect } from "react";

export default function Tooltip({ children, content }) {
  const [open, setOpen] = useState(false);
  const [vertical, setVertical] = useState("top"); // top | bottom
  const [horizontal, setHorizontal] = useState("center"); // center | left | right

  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  const tooltipIdRef = useRef(
    "tooltip-" + Math.random().toString(36).slice(2)
    );

  function calculatePosition() {
    if (!containerRef.current || !tooltipRef.current) return;

    const triggerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;

    setVertical(
        spaceAbove < tooltipRect.height + 12 && spaceBelow > spaceAbove
        ? "bottom"
        : "top"
    );

    const overflowLeft = tooltipRect.left < 8;
    const overflowRight = tooltipRect.right > window.innerWidth - 8;

    if (overflowLeft) setHorizontal("left");
    else if (overflowRight) setHorizontal("right");
    else setHorizontal("center");
  }

  /* ---------------------------
     Close when clicking outside
  ---------------------------- */
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  /* ---------------------------
     ESC key support
  ---------------------------- */
  useEffect(() => {
    function handleEsc(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  /*----------------------------
    Resize Recalculation
  ----------------------------*/
  useLayoutEffect(() => {
    if (open) calculatePosition();
    }, [open]);

    useEffect(() => {
    function handleResize() {
        if (open) calculatePosition();
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  /* ---------------------------
     Position Classes
  ---------------------------- */
  const verticalClass =
    vertical === "top"
      ? "bottom-full mb-3 origin-bottom"
      : "top-full mt-3 origin-top";

  const horizontalClass =
    horizontal === "center"
      ? "left-1/2 -translate-x-1/2"
      : horizontal === "left"
      ? "left-0"
      : "right-0";

  const arrowPosition =
    horizontal === "center"
      ? "left-1/2 -translate-x-1/2"
      : horizontal === "left"
      ? "left-4"
      : "right-4";

  const arrowVertical =
    vertical === "top" ? "-bottom-1" : "-top-1";

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
    >
      {/* Trigger */}
      <div
        tabIndex={0}
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-describedby={open ? tooltipIdRef.current : undefined}
        className="cursor-pointer outline-none"
      >
        {children}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        id={tooltipIdRef.current}
        role="tooltip"
        className={`
          absolute z-50 w-64
          bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${verticalClass}
          ${horizontalClass}
          ${open
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"}
        `}
      >
        {content}

        {/* Arrow */}
        <div
          className={`
            absolute w-2 h-2 bg-gray-900 rotate-45
            ${arrowVertical}
            ${arrowPosition}
          `}
        />
      </div>
    </div>
  );
}