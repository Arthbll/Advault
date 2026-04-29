"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftInfo {
  name:      string;
  step:      number;
  stepLabel: string;
  savedAt:   string;
}

interface ResumeCampaignModalProps {
  draft:     DraftInfo;
  onResume:  () => void;
  onNew:     () => void;
  onArchive: () => void;
  onClose:   () => void;
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
const TOTAL_STEPS = 8;

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ResumeCampaignModal({
  draft, onResume, onNew, onArchive, onClose,
}: ResumeCampaignModalProps) {
  const savedDate = new Date(draft.savedAt);
  const diffMs    = Date.now() - savedDate.getTime();
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays  = Math.floor(diffHours / 24);
  const timeLabel = diffDays  > 0 ? `${diffDays}d ago`
                  : diffHours > 0 ? `${diffHours}h ago`
                  : diffMins  > 0 ? `${diffMins} min ago`
                  : "just now";

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const ROW: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 20, padding: "16px 20px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
  };

  return createPortal(
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="resume-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.60)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24, zIndex: 1000,
        }}
      >
        {/* Modal */}
        <motion.div
          key="resume-modal-panel"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.32, ease: EASE }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 560,
            borderRadius: 24, border: "1px solid rgba(255,255,255,0.09)",
            background: "linear-gradient(180deg, rgba(14,15,22,0.99), rgba(9,10,15,0.99))",
            boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
            overflow: "hidden",
          }}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div style={{
            padding: "18px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>

            {/* Meta row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em",
                color: "rgba(253,230,138,0.8)",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.18)",
                borderRadius: 999, padding: "3px 10px",
              }}>Draft in progress</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {draft.name} · {draft.stepLabel} — step {draft.step + 1}/{TOTAL_STEPS} · saved {timeLabel}
              </span>
            </div>

            {/* Title + close */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: "#fff", marginBottom: 4 }}>
                  Continue where you left off?
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                  Pick an option below.
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  flexShrink: 0, borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.03)",
                  padding: "6px 12px", fontSize: 12,
                  color: "rgba(255,255,255,0.45)",
                  cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Row 1 — Resume */}
            <div style={ROW}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 3 }}>
                  Pick up where I stopped
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                  Back to step {draft.step + 1} — {draft.stepLabel}. All your fields are still there.
                </div>
              </div>
              <button
                onClick={onResume}
                style={{
                  flexShrink: 0, whiteSpace: "nowrap",
                  padding: "8px 18px", borderRadius: 10,
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  color: "#6ee7b7",
                  fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s",
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.22)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.15)"; }}
              >
                Continue draft
              </button>
            </div>

            {/* Row 2 — New */}
            <div style={ROW}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 3 }}>
                  Start a fresh campaign
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                  Blank wizard from step 1. The current draft stays in Archived.
                </div>
              </div>
              <button
                onClick={onNew}
                style={{
                  flexShrink: 0, whiteSpace: "nowrap",
                  padding: "8px 18px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s",
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                New campaign
              </button>
            </div>

            {/* Row 3 — Archive */}
            <div style={ROW}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 3 }}>
                  Save this draft for later
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
                  Not deleted. Stays in Archived — resume or delete it anytime.
                </div>
              </div>
              <button
                onClick={onArchive}
                style={{
                  flexShrink: 0, whiteSpace: "nowrap",
                  padding: "8px 18px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s, color 0.15s",
                } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
              >
                Archive draft
              </button>
            </div>

          </div>

          {/* ── Dismiss ─────────────────────────────────────────────────────── */}
          <div style={{ paddingBottom: 16, textAlign: "center" }}>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none",
                fontSize: 12, color: "rgba(255,255,255,0.22)",
                cursor: "pointer", fontFamily: "inherit",
                padding: "4px 8px",
              }}
            >
              Dismiss
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
