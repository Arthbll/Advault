"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: "green" | "red" | "gold" | "neutral";
  icon?:   ReactNode;
  index?:  number;
  badge?:  string;
  trend?:  "up" | "down" | null;
  large?:  boolean;
}

// Animated number counter for numeric values
function AnimatedValue({ raw, formatted, large }: { raw: number | null; formatted: string; large?: boolean }) {
  const [display, setDisplay] = useState(formatted);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (raw === null) { setDisplay(formatted); return; }

    // Cancel any running animation before starting a new one
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const duration = 900;
    const start    = performance.now();

    const raf = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const cur  = raw * ease;

      const prefix = formatted.startsWith("$") ? "$" : formatted.startsWith("€") ? "€" : "";
      const suffix = formatted.endsWith("%") ? "%" : "";
      const num    = Math.abs(cur);
      const sign   = raw < 0 && cur !== 0 ? "-" : "";
      setDisplay(`${sign}${prefix}${num >= 1000 ? (num / 1000).toFixed(1) + "k" : num.toFixed(num < 10 ? 2 : 0)}${suffix}`);

      if (p < 1) { rafRef.current = requestAnimationFrame(raf); }
      else        { setDisplay(formatted); rafRef.current = null; }
    };

    rafRef.current = requestAnimationFrame(raf);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [raw, formatted]);

  return (
    <span style={{
      fontSize:   large ? 32 : 24,
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1,
      fontVariantNumeric: "tabular-nums",
      fontFeatureSettings: '"tnum"',
    }}>
      {display}
    </span>
  );
}

export default function KpiCard({ label, value, sub, accent = "neutral", index = 0, badge, trend, large }: KpiCardProps) {
  const isSignal = accent === "green" || accent === "red";
  const color    = accent === "green" ? "#4ADE80" : accent === "red" ? "#F97373" : accent === "gold" ? "#FACC6B" : "#F5F5F7";
  const glowRGB  = accent === "green" ? "74,222,128" : accent === "red" ? "249,115,115" : accent === "gold" ? "250,204,107" : "255,255,255";

  // Try to parse numeric value for animation
  const numericMatch = value.replace(/[$€,%\s]/g, "").replace("k", "000");
  const rawNum       = !isNaN(parseFloat(numericMatch)) ? parseFloat(numericMatch) : null;

  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.055, ease: [0.23, 1, 0.32, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={()   => setHovered(false)}
      style={{
        position:   "relative",
        overflow:   "hidden",
        background: "#111113",
        borderRadius: 20,
        padding:    large ? "22px 24px" : "18px 20px",
        display:    "flex", flexDirection: "column",
        gap:        large ? 10 : 8,
        border:     hovered ? `1px solid rgba(${glowRGB},0.16)` : "1px solid rgba(255,255,255,0.06)",
        boxShadow:  hovered
          ? "0 10px 30px rgba(0,0,0,0.65)"
          : "0 6px 18px rgba(0,0,0,0.65)",
        transform:  hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "border-color 0.2s, box-shadow 0.25s, transform 0.18s",
        cursor:     "default",
      }}
    >
      {/* Top accent line */}
      {isSignal && (
        <div style={{
          position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
          background: `linear-gradient(90deg, transparent, rgba(${glowRGB},0.6), transparent)`,
        }} />
      )}

      {/* Label + badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#52525B", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: "3px 8px", borderRadius: 99,
            background: isSignal
              ? (accent === "green" ? "rgba(0,255,135,0.1)" : "rgba(255,69,58,0.1)")
              : "rgba(255,255,255,0.06)",
            color: isSignal ? color : "#52525B",
            border: `1px solid ${isSignal ? `rgba(${glowRGB},0.2)` : "rgba(255,255,255,0.06)"}`,
            letterSpacing: "0.02em",
          }}>
            {badge}
          </span>
        )}
      </div>

      {/* Value + trend */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, color: isSignal ? color : "#F5F5F7" }}>
        <AnimatedValue raw={rawNum} formatted={value} large={large} />
        {trend && (
          <span style={{ marginBottom: 3 }}>
            {trend === "up"
              ? <TrendingUp  size={large ? 15 : 13} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.5))" }} />
              : <TrendingDown size={large ? 15 : 13} strokeWidth={1.5} style={{ color: "#FF453A" }} />
            }
          </span>
        )}
      </div>

      {/* Sub */}
      {sub && (
        <p style={{ fontSize: 12, color: "#3F3F46", lineHeight: 1.4, fontVariantNumeric: "tabular-nums", margin: 0 }}>
          {sub}
        </p>
      )}

      {/* Ambient glow bottom */}
      {isSignal && hovered && (
        <div style={{
          position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)",
          width: "60%", height: 40, borderRadius: "50%",
          background: `rgba(${glowRGB},0.08)`,
          filter: "blur(12px)",
          pointerEvents: "none",
        }} />
      )}
    </motion.div>
  );
}
