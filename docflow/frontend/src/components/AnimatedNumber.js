import React, { useEffect, useRef, useState } from "react";

export default function AnimatedNumber({ value, duration = 800, className = "" }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const numValue = parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
  const suffix = String(value).includes("%") ? "%" : "";

  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const to = numValue;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [numValue, duration]);

  return (
    <span className={`font-mono ${className}`}>
      {display}{suffix}
    </span>
  );
}
