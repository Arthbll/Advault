"use client";

import { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "gold" | "neutral" | "violet";
  icon?: ReactNode;
}

const accentMap = {
  green:   { text: "#4ade80",  glow: "rgba(74,222,128,0.25)"   },
  red:     { text: "#f87171",  glow: "rgba(248,113,113,0.25)"  },
  gold:    { text: "#fbbf24",  glow: "rgba(251,191,36,0.25)"   },
  neutral: { text: "#a1a1aa",  glow: "rgba(161,161,170,0.15)"  },
  violet:  { text: "#a78bfa",  glow: "rgba(139,92,246,0.25)"   },
};

export default function KpiCard({ label, value, sub, accent = "neutral", icon }: KpiCardProps) {
  const { text, glow } = accentMap[accent];

  return (
    <div style={{
      background: "#111115",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 24,
      padding: "22px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent glow line */}
      <div style={{
        position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
        background: `linear-gradient(90deg, transparent, ${glow}, transparent)`,
      }} />

      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.1em", textTransform: "uppercase" as const,
          color: "#52525b",
        }}>
          {label}
        </span>
        {icon ? icon : (
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: text,
            boxShadow: `0 0 8px 3px ${glow}`,
          }} />
        )}
      </div>

      {/* Big number */}
      <div style={{
        fontSize: 30, fontWeight: 300,
        letterSpacing: "-0.02em",
        color: text, lineHeight: 1,
      }}>
        {value}
      </div>

      {/* Sub label */}
      {sub && (
        <p style={{ fontSize: 11, color: "#3f3f46", margin: 0, lineHeight: 1.4 }}>{sub}</p>
      )}
    </div>
  );
}
