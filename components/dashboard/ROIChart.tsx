"use client";

import { useEffect, useState } from "react";

interface Props {
  roi:       number;
  profitPos: boolean;
  height?:   number;
}

// Interpolates the gradient color at a given position (0–100)
// Matches the linearGradient stops: #a07070 → #c08835 → #6b9e82
function gradientColorAt(pct: number): string {
  const stops = [
    { p: 0,    r: 0xa0, g: 0x70, b: 0x70 },
    { p: 0.42, r: 0xc0, g: 0x88, b: 0x35 },
    { p: 1,    r: 0x6b, g: 0x9e, b: 0x82 },
  ];
  const t = Math.max(0, Math.min(1, pct / 100));
  let lo = stops[0], hi = stops[1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].p && t <= stops[i + 1].p) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const s = (t - lo.p) / (hi.p - lo.p);
  const r = Math.round(lo.r + (hi.r - lo.r) * s);
  const g = Math.round(lo.g + (hi.g - lo.g) * s);
  const b = Math.round(lo.b + (hi.b - lo.b) * s);
  return `rgb(${r},${g},${b})`;
}

export default function ROIChart({ roi, profitPos, height = 150 }: Props) {
  const isEmpty    = roi === 0;
  const color      = isEmpty ? "#3f3f46" : profitPos ? "#6b9e82" : "#a07070";
  const label      = isEmpty ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
  const displayPct = isEmpty ? 0 : Math.min(Math.abs(roi), 100);

  // Color at the tip of the fill arc — follows the gradient exactly
  const dotColor = isEmpty ? "#3f3f46" : gradientColorAt(displayPct);

  // Trigger animation after mount
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Arc geometry: 140° → clockwise 260° → 40°, gap at bottom
  const cx = 60, cy = 60, r = 52, sw = 7;
  const startDeg  = 140;
  const totalSpan = 260;

  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: +(cx + r * Math.cos(rad)).toFixed(3),
      y: +(cy + r * Math.sin(rad)).toFixed(3),
    };
  };

  const arcPath = (fromDeg: number, spanDeg: number): string => {
    if (spanDeg < 0.5) return "";
    const s = polar(fromDeg);
    const e = polar(fromDeg + spanDeg);
    const largeArc = spanDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const fillSpan     = (displayPct / 100) * totalSpan;
  // Arc lengths (circumference of circular arc)
  const arcLength    = +(r * totalSpan * Math.PI / 180).toFixed(2);
  const fillLength   = +(r * fillSpan  * Math.PI / 180).toFixed(2);

  // Dash animation: strokeDasharray = [arcLength arcLength]
  // offset L  → nothing visible; offset L-fillLength → shows fillLength from start
  const dashOffset = animated ? arcLength - fillLength : arcLength;

  // Glowing dot position (endpoint of fill arc)
  const dotPos = fillSpan > 3 ? polar(startDeg + fillSpan) : null;

  return (
    <svg
      viewBox="0 0 120 108"
      width="100%"
      height={height}
      overflow="visible"
      style={{ display: "block" }}
    >
      <defs>
        {/* Gradient along the arc: red (start/left) → orange (mid/top) → green (end/right) */}
        {/* The arc goes left→top→right so gradient goes left-to-right visually */}
        <linearGradient id="roi-track-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#a07070" stopOpacity="0.55" />
          <stop offset="42%"  stopColor="#c08835" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6b9e82" stopOpacity="0.55" />
        </linearGradient>

        <linearGradient id="roi-fill-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#a07070" />
          <stop offset="42%"  stopColor="#c08835" />
          <stop offset="100%" stopColor="#6b9e82" />
        </linearGradient>

        {/* Soft glow filter for the dot */}
        <filter id="roi-dot-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Keyframe for pulsing ring */}
        <style>{`
          @keyframes roi-pulse {
            0%, 100% { opacity: 0.25; transform: scale(1); }
            50%       { opacity: 0.6;  transform: scale(1.5); }
          }
          .roi-ring {
            transform-origin: inherit;
            transform-box: fill-box;
            animation: roi-pulse 2.2s ease-in-out infinite;
          }
        `}</style>
      </defs>

      {/* ── Track (gradient) ── */}
      <path
        d={arcPath(startDeg, totalSpan)}
        fill="none"
        stroke={isEmpty ? "rgba(255,255,255,0.04)" : "url(#roi-track-grad)"}
        strokeWidth={sw}
        strokeLinecap="round"
      />

      {/* ── Animated fill (gradient) ── */}
      {fillSpan > 0.5 && (
        <path
          d={arcPath(startDeg, totalSpan)}
          fill="none"
          stroke="url(#roi-fill-grad)"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${arcLength}`}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.95s cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        />
      )}

      {/* ── Glowing dot at fill endpoint ── */}
      {dotPos && (
        <>
          {/* Pulsing outer ring */}
          <circle
            className="roi-ring"
            cx={dotPos.x}
            cy={dotPos.y}
            r={sw / 2 + 4}
            fill={dotColor}
            opacity={0.4}
          />
          {/* Glow halo — colored */}
          <circle
            cx={dotPos.x}
            cy={dotPos.y}
            r={sw / 2 + 2}
            fill={dotColor}
            opacity={0.9}
            filter="url(#roi-dot-glow)"
          />
          {/* White core — contrast against the arc */}
          <circle
            cx={dotPos.x}
            cy={dotPos.y}
            r={sw / 2 - 2}
            fill="white"
            opacity={0.95}
          />
        </>
      )}

      {/* ── Value ── */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isEmpty ? "rgba(255,255,255,0.18)" : color}
        fontSize="17"
        fontWeight="300"
        fontFamily="inherit"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </text>

      {/* ── Sub-label ── */}
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(80,80,88,0.9)"
        fontSize="9"
        fontWeight="700"
        fontFamily="inherit"
        letterSpacing="1.5"
      >
        ROI
      </text>
    </svg>
  );
}
