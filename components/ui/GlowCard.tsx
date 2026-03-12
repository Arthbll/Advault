"use client";

import { useRef, useState, ReactNode } from "react";

interface Props {
  children:   ReactNode;
  glowColor?: string;  // RGB triplet e.g. "0,255,135"
  style?:     React.CSSProperties;
  onClick?:   () => void;
}

export default function GlowCard({ children, glowColor = "0,255,135", style, onClick }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);

  const BASE_SHADOW = "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)";
  const HOVER_SHADOW = `0 0 0 1px rgba(${glowColor},0.12), 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(${glowColor},0.07)`;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={e => {
        const r = cardRef.current?.getBoundingClientRect();
        if (r) setSpot({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = `rgba(${glowColor},0.2)`;
        el.style.boxShadow   = HOVER_SHADOW;
        el.style.transform   = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(255,255,255,0.06)";
        el.style.boxShadow   = BASE_SHADOW;
        el.style.transform   = "translateY(0)";
        setSpot(null);
      }}
      style={{
        position:   "relative",
        overflow:   "hidden",
        background: "#111113",
        border:     "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        boxShadow:  BASE_SHADOW,
        transition: "border-color 0.2s, box-shadow 0.25s, transform 0.18s",
        cursor:     onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {/* Spotlight radial */}
      {spot && (
        <div
          style={{
            position: "absolute", pointerEvents: "none",
            width: 320, height: 320, borderRadius: "50%",
            left: spot.x - 160, top: spot.y - 160,
            background: `radial-gradient(circle, rgba(${glowColor},0.07) 0%, transparent 65%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
