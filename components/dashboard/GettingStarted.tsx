"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const STEPS = [
  { id: "connect",  label: "Connect a network",   href: "/dashboard/settings"       },
  { id: "campaign", label: "Create a campaign",   href: "/dashboard/campaigns/new"  },
  { id: "stats",    label: "Explore your stats",  href: "/dashboard/statistics"     },
];

const LS_KEY = "gs_dismissed";

export default function GettingStarted({ hasAccounts, hasCampaigns }: {
  hasAccounts:  boolean;
  hasCampaigns: boolean;
}) {
  const [visible,   setVisible]   = useState(false);
  const [done,      setDone]      = useState<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) return;
    // Self-fetch real account status (overrides props)
    fetch("/api/user/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const acc = d?.hasAccounts  ?? hasAccounts;
        const cam = d?.hasCampaigns ?? hasCampaigns;
        setDone({ connect: acc, campaign: cam, stats: cam });
        setVisible(true);
      })
      .catch(() => {
        setDone({ connect: hasAccounts, campaign: hasCampaigns, stats: hasCampaigns });
        setVisible(true);
      });
  }, [hasAccounts, hasCampaigns]);

  const completedCount = STEPS.filter(s => done[s.id]).length;
  const progress       = completedCount / STEPS.length; // 0 → 1

  function dismiss() {
    localStorage.setItem(LS_KEY, "1");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          style={{ padding: "0 22px", marginBottom: 2 }}
        >
          {/* ── Strip ─────────────────────────────────────────────────────── */}
          <div style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 18px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}>

            {/* Steps inline */}
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {STEPS.map((step, i) => {
                const isDone    = done[step.id];
                const isHovered = hoveredId === step.id;
                const isNext    = !isDone && STEPS.slice(0, i).every(s => done[s.id]);

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 + i * 0.09, ease: [0.23, 1, 0.32, 1] }}
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    {/* Separator */}
                    {i > 0 && (
                      <span style={{
                        margin: "0 14px",
                        fontSize: 10,
                        color: "rgba(255,255,255,0.08)",
                        userSelect: "none",
                      }}>
                        /
                      </span>
                    )}

                    <Link
                      href={step.href}
                      onMouseEnter={() => setHoveredId(step.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        textDecoration: "none",
                        cursor: isDone ? "default" : "pointer",
                      }}
                    >
                      {/* Number badge */}
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16, height: 16,
                        borderRadius: 5,
                        fontSize: 9, fontWeight: 700,
                        letterSpacing: "0.02em",
                        flexShrink: 0,
                        background: isDone
                          ? "rgba(74,222,128,0.12)"
                          : isNext
                          ? "rgba(139,92,246,0.15)"
                          : "rgba(255,255,255,0.04)",
                        color: isDone
                          ? "#4ade80"
                          : isNext
                          ? "#a78bfa"
                          : "#3f3f46",
                        transition: "all 0.2s",
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      {/* Label */}
                      <span style={{
                        fontSize: 12,
                        fontWeight: isNext ? 500 : 400,
                        letterSpacing: "-0.01em",
                        color: isDone
                          ? "rgba(255,255,255,0.2)"
                          : isNext
                          ? isHovered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)"
                          : "rgba(255,255,255,0.18)",
                        textDecoration: isDone ? "line-through" : "none",
                        textDecorationColor: "rgba(255,255,255,0.12)",
                        transition: "color 0.2s",
                      }}>
                        {step.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Right: fraction + dismiss */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.3 }}
              style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}
            >
              <span style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: "0.08em",
                color: completedCount === STEPS.length ? "#4ade80" : "rgba(255,255,255,0.18)",
                textTransform: "uppercase" as const,
              }}>
                {completedCount === STEPS.length ? "All set ✓" : `${completedCount} / ${STEPS.length}`}
              </span>

              <button
                onClick={dismiss}
                style={{
                  background: "none", border: "none",
                  padding: 0, cursor: "pointer",
                  color: "rgba(255,255,255,0.15)",
                  fontSize: 14, lineHeight: 1,
                  transition: "color 0.15s",
                  display: "flex", alignItems: "center",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.15)")}
              >
                ×
              </button>
            </motion.div>

            {/* ── Progress hairline (bottom) ─────────────────────────────── */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: 1,
              background: "rgba(255,255,255,0.04)",
            }}>
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  height: "100%",
                  background: completedCount === STEPS.length
                    ? "linear-gradient(90deg, rgba(74,222,128,0.6), rgba(74,222,128,0.2))"
                    : "linear-gradient(90deg, rgba(139,92,246,0.7), rgba(167,139,250,0.3))",
                  boxShadow: completedCount === STEPS.length
                    ? "0 0 8px rgba(74,222,128,0.4)"
                    : "0 0 8px rgba(139,92,246,0.5)",
                }}
              />
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
