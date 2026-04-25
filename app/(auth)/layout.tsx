"use client";

import { motion } from "framer-motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090e",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── Atmospheric halos ─────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 20%, rgba(99,102,241,0.14) 0%, transparent 18%), " +
            "radial-gradient(circle at 24% 68%, rgba(56,189,248,0.07) 0%, transparent 16%), " +
            "radial-gradient(circle at 76% 64%, rgba(168,85,247,0.10) 0%, transparent 18%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Signal ring ───────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          left: "50%",
          top: "18%",
          transform: "translateX(-50%)",
          width: 560,
          height: 560,
          borderRadius: "50%",
          border: "1px solid rgba(139,92,246,0.09)",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.11) 0%, rgba(99,102,241,0.03) 40%, transparent 72%)",
          pointerEvents: "none",
        }}
      />
      {/* Inner ring */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "18%",
          transform: "translateX(-50%) scale(0.62)",
          width: 560,
          height: 560,
          borderRadius: "50%",
          border: "1px solid rgba(99,102,241,0.06)",
          pointerEvents: "none",
        }}
      />

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 24px 80px",
        }}
      >
        {children}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <p
        style={{
          position: "absolute",
          bottom: 24,
          fontSize: 11,
          color: "rgba(255,255,255,0.14)",
          letterSpacing: "0.04em",
          textAlign: "center",
          margin: 0,
          pointerEvents: "none",
        }}
      >
        Traffic · Revenue · Rules &nbsp;·&nbsp; Built for media buyers &nbsp;·&nbsp; Private beta
      </p>
    </div>
  );
}
