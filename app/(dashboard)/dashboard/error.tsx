"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard error]", error);
  }, [error]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      minHeight: "60vh", gap: 20, padding: "40px",
    }}>
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        style={{
          width: 56, height: 56, borderRadius: 17,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.15)",
        }}
      >
        <AlertTriangle size={22} strokeWidth={1.5} style={{ color: "#f87171" }} />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 400, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.85)", margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
          An unexpected error occurred. You can try again or come back later.
        </p>
        {error.digest && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", fontFamily: "monospace", marginTop: 4 }}>
            Ref: {error.digest}
          </p>
        )}
      </motion.div>

      {/* Reset button */}
      <motion.button
        onClick={reset}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        whileHover={{ background: "rgba(139,92,246,0.18)", borderColor: "rgba(139,92,246,0.4)" }}
        whileTap={{ scale: 0.97 }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "11px 22px", borderRadius: 12,
          background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.22)",
          color: "#a78bfa", fontSize: 13, fontWeight: 500,
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <RotateCcw size={13} strokeWidth={1.5} />
        Try again
      </motion.button>
    </div>
  );
}
