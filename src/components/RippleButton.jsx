// src/components/RippleButton.jsx
import React, { useState } from "react";

export default function RippleButton({ children, onClick, className = "" }) {
  const [rippleArray, setRippleArray] = useState([]);

  const createRipple = (event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple = { x, y, size };
    setRippleArray((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRippleArray((prev) => prev.slice(1));
    }, 600);
  };

  const handleClick = (e) => {
    createRipple(e);
    if (onClick) onClick(e);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative overflow-hidden select-none ${className}`}
    >
      {children}

      {rippleArray.map((r, i) => (
        <span
          key={i}
          className="absolute bg-white opacity-30 rounded-full animate-ripple"
          style={{
            top: r.y,
            left: r.x,
            width: r.size,
            height: r.size,
          }}
        ></span>
      ))}
    </button>
  );
}
