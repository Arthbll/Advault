"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, TrendingDown } from "lucide-react";

const EASE: [number,number,number,number] = [0.23, 1, 0.32, 1];

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#0d0d10", gap: 0, overflow: "hidden",
      position: "relative",
    }}>
      {/* Ambient */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(248,113,113,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />

      {/* Animated 404 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ position: "relative", marginBottom: 8 }}
      >
        <span style={{
          fontSize: 180, fontWeight: 200, letterSpacing: "-0.06em",
          color: "rgba(255,255,255,0.04)",
          lineHeight: 1, display: "block",
          userSelect: "none",
        }}>
          404
        </span>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center", gap: 14,
          }}
        >
          <TrendingDown size={28} strokeWidth={1} style={{ color: "#f87171", opacity: 0.7 }} />
          <span style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.5)" }}>
            Page introuvable
          </span>
        </motion.div>
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: EASE }}
        style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}
      >
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", lineHeight: 1.6, maxWidth: 380, margin: 0 }}>
          This page doesn&apos;t exist — or you just tried clicking a broken link.
          Don&apos;t worry, your capital is safe.
        </p>

        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 22px", borderRadius: 12, marginTop: 8,
              background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
              color: "#a78bfa", fontSize: 13, fontWeight: 500,
              textDecoration: "none", transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.18)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.10)"; }}
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Back to dashboard
          </Link>
        </motion.div>

        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.1)", marginTop: 4, letterSpacing: "0.04em" }}>
          ProfitDash · Erreur 404
        </p>
      </motion.div>
    </div>
  );
}
