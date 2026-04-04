"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

// ─── Palette ──────────────────────────────────────────────────────────────────
const GREEN  = "#4ade80";
const RED    = "#f87171";
const EASE   = [0.16, 1, 0.3, 1] as const;

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, delay = 0 }: { to: number; delay?: number }) {
  const count   = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, to, {
      duration: 1.8,
      delay,
      ease: EASE,
    });
    return controls.stop;
  }, []);

  return <motion.span>{rounded}</motion.span>;
}

// ─── Signal chart path ────────────────────────────────────────────────────────
const SIGNAL_PATH =
  "M0,130 C80,108 120,152 210,118 C278,90 338,128 408,82 " +
  "C465,48 528,70 598,104 C668,138 742,80 818,93 " +
  "C882,104 935,58 1000,78";

// ─── Stat tile ────────────────────────────────────────────────────────────────
interface StatProps {
  label: string;
  value: number;
  accent: string;
  delay: number;
}
function Stat({ label, value, accent, delay }: StatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      style={{
        borderRadius: 18,
        border: `1px solid ${accent}26`,
        background: `${accent}0d`,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.24)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 34,
          fontWeight: 200,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          color: "rgba(255,255,255,0.88)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Counter to={value} delay={delay + 0.2} />
      </span>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AuthBrandPanel() {
  return (
    <div
      style={{
        flex: 1,
        background: "#07080e",
        borderLeft: "1px solid rgba(255,255,255,0.05)",
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
      }}
    >
      {/* ── Ambient glows ──────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: "6%",  right: "18%", width: 500, height: 420, background: "radial-gradient(ellipse, rgba(56,189,248,0.07) 0%, transparent 65%)",   pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "8%",  left:  "10%", width: 400, height: 360, background: "radial-gradient(ellipse, rgba(99,102,241,0.10) 0%, transparent 65%)",  pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom:"8%",right: "12%", width: 440, height: 380, background: "radial-gradient(ellipse, rgba(168,85,247,0.07) 0%, transparent 65%)",  pointerEvents: "none" }} />

      {/* ── System scene card ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 520,
          background: "linear-gradient(180deg, rgba(14,15,24,0.88) 0%, rgba(9,10,16,0.72) 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 28,
          boxShadow: "0 40px 100px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
          backdropFilter: "blur(8px)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ padding: "28px 28px 0" }}>
          <p
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.26em",
              color: "rgba(255,255,255,0.22)",
              margin: "0 0 10px",
            }}
          >
            Decision engine
          </p>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 200,
              letterSpacing: "-0.04em",
              color: "rgba(255,255,255,0.88)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Signal in motion
          </h2>
        </div>

        {/* ── Chart ──────────────────────────────────────────────────────── */}
        <div
          style={{
            margin: "20px 28px 0",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(0,0,0,0.20)",
            height: 190,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Chart inner glows */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 25% 55%, rgba(56,189,248,0.08) 0%, transparent 28%), radial-gradient(circle at 72% 32%, rgba(139,92,246,0.10) 0%, transparent 24%)", pointerEvents: "none" }} />

          <svg
            viewBox="0 0 1000 190"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", padding: "20px 16px" }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="signalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="48%"  stopColor="#8b5cf6" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Draw-in animation on the path */}
            <motion.path
              d={SIGNAL_PATH}
              fill="none"
              stroke="url(#signalGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Glow duplicate (blurred) */}
            <motion.path
              d={SIGNAL_PATH}
              fill="none"
              stroke="url(#signalGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "blur(6px)" }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.18 }}
              transition={{ duration: 2.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            padding: "16px 28px 28px",
          }}
        >
          <Stat label="Scaling" value={11} accent={GREEN} delay={0.9} />
          <Stat label="Watching" value={3}  accent="rgba(255,255,255,0.6)" delay={1.05} />
          <Stat label="Action"  value={1}  accent={RED}   delay={1.2} />
        </div>
      </motion.div>

      {/* ── Ghost wordmark ───────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.07 }}
        transition={{ duration: 2, delay: 1.5 }}
        style={{
          position: "absolute",
          bottom: 26,
          left: 0,
          right: 0,
          textAlign: "center",
          margin: 0,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.42em",
          textTransform: "uppercase",
          color: "white",
          pointerEvents: "none",
        }}
      >
        ProfitDash
      </motion.p>
    </div>
  );
}
