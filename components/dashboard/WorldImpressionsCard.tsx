"use client";

import { motion } from "framer-motion";

function fmtN(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export default function WorldImpressionsCard({
  totalImpressions,
  sources,
}: {
  totalImpressions: number;
  sources: Array<{ label: string; value: number }>;
}) {
  const top = sources.slice().sort((a, b) => b.value - a.value).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -2 }}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        padding: "18px 20px",
        background: "radial-gradient(circle at 30% 20%, rgba(129,140,248,0.25), transparent 55%), rgba(5,8,22,0.98)",
        border: "1px solid rgba(55,65,81,0.9)",
        boxShadow: "0 18px 45px rgba(15,23,42,0.9)",
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7280", marginBottom: 4 }}>
            Impressions
          </p>
          <motion.p
            key={totalImpressions}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            style={{
              fontSize: 30,
              fontWeight: 750,
              letterSpacing: "-0.04em",
              color: "#F9FAFB",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmtN(totalImpressions)}
          </motion.p>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
            Impressions totales sur la période
          </p>
        </div>
      </div>

      {/* Map */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 64,
          bottom: 0,
          opacity: 0.85,
          pointerEvents: "none",
        }}
      >
        <svg viewBox="0 0 900 420" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="dot" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.1" fill="rgba(148,163,184,0.18)" />
            </pattern>
            <linearGradient id="mapGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgba(129,140,248,0.24)" />
              <stop offset="0.55" stopColor="rgba(74,222,128,0.16)" />
              <stop offset="1" stopColor="rgba(250,204,107,0.14)" />
            </linearGradient>
            <mask id="mapMask">
              <rect width="900" height="420" fill="white" />
              {/* rough world silhouette */}
              <path
                d="M90,160 C120,120 190,110 220,140 C250,170 300,150 330,140 C370,125 390,150 420,165 C455,183 510,170 540,150 C575,128 640,120 690,150 C735,176 780,150 820,170 C845,185 845,230 820,245 C780,270 740,260 700,270 C660,282 620,310 580,300 C540,292 515,275 490,260 C460,242 420,260 390,270 C350,285 320,270 290,260 C255,248 235,265 205,255 C160,240 120,250 95,230 C70,210 65,185 90,160 Z"
                fill="black"
              />
            </mask>
          </defs>

          <rect x="0" y="0" width="900" height="420" fill="url(#dot)" mask="url(#mapMask)" />
          <rect x="0" y="0" width="900" height="420" fill="url(#mapGlow)" opacity="0.65" mask="url(#mapMask)" />

          {/* soft vignette */}
          <rect x="0" y="0" width="900" height="420" fill="url(#mapGlow)" opacity="0.12" />
        </svg>
      </div>

      {/* Sources list */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Principales sources</p>
          <p style={{ fontSize: 11, color: "#6B7280", margin: 0 }}>Part</p>
        </div>

        {top.map(s => {
          const share = totalImpressions > 0 ? (s.value / totalImpressions) * 100 : 0;
          return (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#E5E7EB", fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: "#6B7280" }}>
                  {fmtN(s.value)} · {share.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 3, background: "rgba(31,41,55,1)", borderRadius: 999, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(129,140,248,0.65), #4ADE80)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

