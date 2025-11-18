import { useRef } from "react";

export default function RippleButton({ children, className = "", onClick }) {
  const btnRef = useRef(null);

  function createRipple(e) {
    const button = btnRef.current;
    const circle = document.createElement("span");

    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;

    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];
    if (ripple) ripple.remove();

    button.appendChild(circle);

    if (onClick) onClick(e);
  }

  return (
    <button
      ref={btnRef}
      onClick={createRipple}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
    </button>
  );
}
