"use client";

import { ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: "green" | "red" | "gold" | "neutral" | "violet";
  icon?:   ReactNode;
}

// ─── Accent map — aligned to dashboard palette ────────────────────────────────

const accentMap = {
  green:   { text: "#4ade80",                border: "rgba(74,222,128,0.13)"    },
  red:     { text: "#f87171",                border: "rgba(248,113,113,0.13)"   },
  gold:    { text: "#fbbf24",                border: "rgba(251,191,36,0.11)"    },
  neutral: { text: "rgba(255,255,255,0.72)", border: "rgba(255,255,255,0.07)"   },
  violet:  { text: "#a78bfa",                border: "rgba(167,139,250,0.13)"   },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function KpiCard({ label, value, sub, accent = "neutral", icon }: KpiCardProps) {
  const { text, border } = accentMap[accent];

  return (
    <div style={{
      background: "#17171e",
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          color: "#3f3f46",
        }}>
          {label}
        </span>
        {icon ?? (
          <div style={{
            width: 4, height: 4, borderRadius: "50%",
            background: text, opacity: 0.5,
          }} />
        )}
      </div>

      {/* Value */}
      <span style={{
        fontSize: 26, fontWeight: 400,
        letterSpacing: "-0.03em", lineHeight: 1,
        color: text,
        fontVariantNumeric: "tabular-nums",
        fontFeatureSettings: '"tnum"',
        display: "block",
      }}>
        {value}
      </span>

      {/* Sub label */}
      {sub && (
        <span style={{
          fontSize: 10, color: "rgba(255,255,255,0.2)",
          lineHeight: 1.45, letterSpacing: "0.01em",
        }}>
          {sub}
        </span>
      )}
    </div>
  );
}
