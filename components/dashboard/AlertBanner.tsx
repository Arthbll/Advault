"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingDown, XCircle, X, RefreshCw } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertCampaign {
  id:      string;
  name:    string;
  network: string;
  roi:     number;
  spend:   number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NET_META: Record<string, { label: string; color: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9" },
  VOLUUM:       { label: "Voluum",       color: "#10b981" },
  BEMOB:        { label: "Bemob",        color: "#f43f5e" },
};

function fmtEuro(n: number): string {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertBanner({ initialAlerts }: { initialAlerts: AlertCampaign[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [acting, setActing] = useState<string | null>(null);
  const [open,   setOpen]   = useState(true);

  if (alerts.length === 0 || !open) return null;

  async function kill(id: string) {
    setActing(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/action`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "pause" }),
      });
      if (res.ok) setAlerts(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
    setActing(null);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(248,113,113,0.032)",
            border: "1px solid rgba(248,113,113,0.14)",
          }}
        >
          {/* ── Panel header ──────────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "13px 20px 11px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Pulsing urgency indicator */}
              <motion.div
                animate={{ opacity: [1, 0.2, 1], scale: [1, 0.7, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#f87171", flexShrink: 0,
                  boxShadow: "0 0 8px rgba(248,113,113,0.55)",
                }}
              />
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
                textTransform: "uppercase" as const, color: "#f87171",
              }}>
                Action required
              </span>
              {/* Campaign count badge */}
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: "rgba(248,113,113,0.12)",
                color: "#f87171",
                border: "1px solid rgba(248,113,113,0.22)",
                borderRadius: 99, padding: "1px 8px",
                fontVariantNumeric: "tabular-nums",
              }}>
                {alerts.length} campaign{alerts.length > 1 ? "s" : ""}
              </span>
            </div>
            <motion.button
              onClick={() => setOpen(false)}
              whileHover={{ opacity: 0.85 }}
              whileTap={{ scale: 0.85 }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 4, display: "flex", alignItems: "center",
                opacity: 0.32,
              }}
            >
              <X size={13} color="#f87171" />
            </motion.button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(248,113,113,0.08)", marginBottom: 4 }} />

          {/* ── Campaign rows ──────────────────────────────────────────────── */}
          <div style={{ paddingBottom: 10 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {alerts.map((alert) => {
                const meta      = NET_META[alert.network] ?? { label: alert.network, color: "#71717a" };
                const isPending = acting === alert.id;

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "10px 20px",
                    }}
                  >
                    {/* Soft urgency stripe */}
                    <div style={{
                      width: 2, height: 30, flexShrink: 0, borderRadius: 99,
                      background: "rgba(248,113,113,0.45)",
                    }} />

                    {/* Campaign name + network */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/dashboard/campaigns/${alert.id}`}
                        style={{ textDecoration: "none" }}
                      >
                        <span style={{
                          fontSize: 13, fontWeight: 500,
                          color: "rgba(255,255,255,0.82)",
                          overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const, display: "block",
                          cursor: "pointer",
                          transition: "color 0.15s",
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.82)"; }}
                        >
                          {alert.name}
                        </span>
                      </Link>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                        color: meta.color, opacity: 0.8,
                      }}>
                        {meta.label}
                      </span>
                    </div>

                    {/* ROI chip — prominent */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 11px", borderRadius: 8, flexShrink: 0,
                      background: "rgba(248,113,113,0.09)",
                      border: "1px solid rgba(248,113,113,0.22)",
                    }}>
                      <TrendingDown size={10} color="#f87171" strokeWidth={2} />
                      <span style={{
                        fontSize: 12, fontWeight: 800,
                        color: "#f87171", fontVariantNumeric: "tabular-nums",
                      }}>
                        {alert.roi.toFixed(0)}%
                      </span>
                    </div>

                    {/* Spend */}
                    <span style={{
                      fontSize: 11, color: "rgba(255,255,255,0.28)",
                      fontVariantNumeric: "tabular-nums", flexShrink: 0,
                      width: 60, textAlign: "right" as const,
                    }}>
                      {fmtEuro(alert.spend)}
                    </span>

                    {/* Kill Now — primary action */}
                    <motion.button
                      onClick={() => kill(alert.id)}
                      disabled={isPending}
                      whileHover={!isPending ? {
                        scale: 1.03,
                        boxShadow: "0 0 18px rgba(248,113,113,0.32)",
                      } : {}}
                      whileTap={{ scale: 0.93 }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 16px", borderRadius: 9, flexShrink: 0,
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                        background: isPending
                          ? "rgba(248,113,113,0.05)"
                          : "rgba(248,113,113,0.11)",
                        border: "1px solid rgba(248,113,113,0.28)",
                        color: "#f87171",
                        cursor: isPending ? "not-allowed" : "pointer",
                        opacity: isPending ? 0.5 : 1,
                        transition: "background 0.15s, opacity 0.15s",
                      }}
                    >
                      {isPending
                        ? <RefreshCw size={10} />
                        : <><XCircle size={11} /> Kill</>}
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
