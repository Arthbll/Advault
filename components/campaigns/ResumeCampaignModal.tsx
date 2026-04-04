"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftInfo {
  name:      string;   // campaign name (or "Sans titre")
  step:      number;   // 0-based step index
  stepLabel: string;   // e.g. "Budget"
  savedAt:   string;   // ISO date string
}

interface ResumeCampaignModalProps {
  draft:     DraftInfo;
  onResume:  () => void;
  onNew:     () => void;
  onArchive: () => void;
  onClose:   () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const TOTAL_STEPS = 8;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ border, bg, color, children }: {
  border: string; bg: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      display: "inline-flex", borderRadius: 999,
      border: `1px solid ${border}`, background: bg,
      padding: "5px 14px", fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.22em", color,
    }}>
      {children}
    </div>
  );
}

function WhatThisMeans({ items }: { items: string[] }) {
  return (
    <div style={{
      borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(0,0,0,0.10)", padding: "10px 14px", marginBottom: 10,
    }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.25)", marginBottom: 7 }}>
        What this means
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
        {items.map((item, i) => <div key={i}>• {item}</div>)}
      </div>
    </div>
  );
}

function ChoiceCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 22, border: "1px solid rgba(255,255,255,0.09)",
      background: "linear-gradient(180deg, rgba(17,18,25,0.98), rgba(12,13,19,0.98))",
      padding: 24,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 12px 40px rgba(0,0,0,0.16)",
    }}>
      {children}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ResumeCampaignModal({
  draft, onResume, onNew, onArchive, onClose,
}: ResumeCampaignModalProps) {
  const savedDate = new Date(draft.savedAt);
  const diffMs    = Date.now() - savedDate.getTime();
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays  = Math.floor(diffHours / 24);
  const timeLabel = diffDays  > 0 ? `${diffDays}j ago`
                  : diffHours > 0 ? `${diffHours}h ago`
                  : diffMins  > 0 ? `${diffMins} min ago`
                  : "just now";

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

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
          background: "rgba(0,0,0,0.50)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 12, zIndex: 1000,
        }}
      >
        {/* Radial glows (decorative, behind modal) */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: [
            "radial-gradient(circle at 20% 0%, rgba(129,140,248,0.08), transparent 34%)",
            "radial-gradient(circle at 80% 10%, rgba(16,185,129,0.05), transparent 24%)",
          ].join(", "),
        }} />

        {/* Modal container */}
        <motion.div
          key="resume-modal-panel"
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          transition={{ duration: 0.4, ease: EASE }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 1200,
            borderRadius: 28, border: "1px solid rgba(255,255,255,0.10)",
            background: "linear-gradient(180deg, rgba(12,13,20,0.98), rgba(8,9,14,0.99))",
            boxShadow: "0 32px 100px rgba(0,0,0,0.55)",
            overflow: "hidden", position: "relative",
          }}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div style={{
            padding: "18px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: [
              "radial-gradient(circle at 18% 0%, rgba(129,140,248,0.09), transparent 36%)",
              "radial-gradient(circle at 85% 10%, rgba(16,185,129,0.06), transparent 26%)",
            ].join(", "),
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>

                {/* Badges row */}
                <Badge border="rgba(251,191,36,0.20)" bg="rgba(245,158,11,0.09)" color="rgba(253,230,138,0.9)">
                  Draft in progress
                </Badge>
                <Badge border="rgba(255,255,255,0.12)" bg="rgba(255,255,255,0.04)" color="rgba(255,255,255,0.65)">
                  {draft.name}
                </Badge>
                <Badge border="rgba(167,139,250,0.20)" bg="rgba(139,92,246,0.09)" color="rgba(221,214,254,0.9)">
                  {draft.stepLabel} — step {draft.step + 1}/{TOTAL_STEPS}
                </Badge>
                <Badge border="rgba(255,255,255,0.07)" bg="rgba(255,255,255,0.02)" color="rgba(255,255,255,0.35)">
                  Saved {timeLabel}
                </Badge>

                {/* Title inline */}
                <h2 style={{
                  fontSize: 18, lineHeight: 1, letterSpacing: "-0.03em",
                  fontWeight: 300, margin: 0, color: "#fff", whiteSpace: "nowrap",
                }}>
                  Continue where you left off?
                </h2>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  flexShrink: 0,
                  borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  padding: "7px 14px", fontSize: 12, color: "rgba(255,255,255,0.55)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div style={{ padding: "16px 20px 18px" }}>

            {/* 3 choice cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>

              {/* Card 1: Resume (emerald) */}
              <ChoiceCard>
                <div>
                  <Badge border="rgba(52,211,153,0.20)" bg="rgba(16,185,129,0.09)" color="rgba(167,243,208,0.9)">
                    Resume current campaign
                  </Badge>
                  <div style={{
                    marginTop: 18, fontSize: 28, lineHeight: 1.08,
                    letterSpacing: "-0.04em", fontWeight: 300, color: "#fff",
                  }}>
                    Pick up right where you stopped.
                  </div>
                  <div style={{
                    marginTop: 10, fontSize: 13.5, lineHeight: 1.65,
                    color: "rgba(255,255,255,0.44)", fontWeight: 300,
                  }}>
                    Go back to the wizard at step {draft.step + 1} — {draft.stepLabel}. Everything you filled in is still there.
                  </div>
                </div>
                <div>
                  <WhatThisMeans items={[
                    `Back to step ${draft.step + 1} — ${draft.stepLabel}`,
                    "All your fields are restored",
                    "Complete and submit when ready",
                  ]} />
                  <button
                    onClick={onResume}
                    style={{
                      width: "100%", borderRadius: 12, border: "none",
                      background: "linear-gradient(90deg, #10b981, #34d399)",
                      color: "#000", padding: "10px 16px",
                      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                      boxShadow: "0 10px 28px rgba(16,185,129,0.28)",
                      cursor: "pointer",
                    }}
                  >
                    Continue draft
                  </button>
                </div>
              </ChoiceCard>

              {/* Card 2: New campaign (violet) */}
              <ChoiceCard>
                <div>
                  <Badge border="rgba(167,139,250,0.20)" bg="rgba(139,92,246,0.09)" color="rgba(221,214,254,0.9)">
                    Start a new campaign
                  </Badge>
                  <div style={{
                    marginTop: 18, fontSize: 28, lineHeight: 1.08,
                    letterSpacing: "-0.04em", fontWeight: 300, color: "#fff",
                  }}>
                    Leave this one behind and restart fresh.
                  </div>
                  <div style={{
                    marginTop: 10, fontSize: 13.5, lineHeight: 1.65,
                    color: "rgba(255,255,255,0.44)", fontWeight: 300,
                  }}>
                    Start the wizard from scratch. This draft will stay archived unless you delete it.
                  </div>
                </div>
                <div>
                  <WhatThisMeans items={[
                    "Blank wizard, fresh start",
                    "Draft is not deleted",
                    "Find it later in Archived",
                  ]} />
                  <button
                    onClick={onNew}
                    style={{
                      width: "100%", borderRadius: 12, border: "none",
                      background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                      color: "#fff", padding: "10px 16px",
                      fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                      boxShadow: "0 10px 28px rgba(99,102,241,0.28)",
                      cursor: "pointer",
                    }}
                  >
                    Start new campaign
                  </button>
                </div>
              </ChoiceCard>

              {/* Card 3: Archive (rose) */}
              <ChoiceCard>
                <div>
                  <Badge border="rgba(252,165,165,0.20)" bg="rgba(244,63,94,0.08)" color="rgba(254,205,211,0.9)">
                    Archive draft
                  </Badge>
                  <div style={{
                    marginTop: 18, fontSize: 28, lineHeight: 1.08,
                    letterSpacing: "-0.04em", fontWeight: 300, color: "#fff",
                  }}>
                    Save this draft for later.
                  </div>
                  <div style={{
                    marginTop: 10, fontSize: 13.5, lineHeight: 1.65,
                    color: "rgba(255,255,255,0.44)", fontWeight: 300,
                  }}>
                    Put this draft aside without losing anything. Find it in the Archived filter whenever you want to pick it back up.
                  </div>
                </div>
                <div>
                  <WhatThisMeans items={[
                    "Draft saved with all your progress",
                    "Visible in Campaigns → Archived",
                    "Resume or delete it anytime",
                  ]} />
                  <button
                    onClick={onArchive}
                    style={{
                      width: "100%", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.12)",
                      color: "rgba(255,255,255,0.84)",
                      padding: "10px 16px", fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    Archive draft
                  </button>
                </div>
              </ChoiceCard>

            </div>

            {/* Archive info banner — compact */}
            <div style={{
              borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.015)", padding: "12px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{
                  fontSize: 9, textTransform: "uppercase", letterSpacing: "0.22em",
                  color: "rgba(255,255,255,0.24)", flexShrink: 0,
                }}>
                  Archive
                </div>
                <div style={{ fontSize: 13, letterSpacing: "-0.02em", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
                  Not deleted. Not active. Stays searchable in history and analytics.
                </div>
              </div>
              <div style={{
                flexShrink: 0, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                padding: "6px 12px", fontSize: 11, color: "rgba(255,255,255,0.5)",
                whiteSpace: "nowrap",
              }}>
                Campaigns → Archived
              </div>
            </div>

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
