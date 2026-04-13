"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Pause, Play, Zap, XCircle, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id:      string;
  name:    string;
  network: string;
  status:  string;
  spend:   number;
  revenue: number;
  profit:  number;
  roi:     number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NET_META: Record<string, { label: string; color: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9" },
  PROPELLERADS: { label: "PropellerAds", color: "#f97316" },
  ADSTERRA:     { label: "Adsterra",     color: "#06b6d4" },
  VOLUUM:       { label: "Voluum",       color: "#10b981" },
  BEMOB:        { label: "Bemob",        color: "#f43f5e" },
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase" as const, letterSpacing: "0.12em",
  color: "#3f3f46",
};

function fmtEuro(n: number): string {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

// ─── Campaign Row ─────────────────────────────────────────────────────────────

function Row({ c, isLast, index, onRemove }: {
  c: CampaignRow;
  isLast: boolean;
  index: number;
  onRemove: (id: string) => void;
}) {
  const router          = useRouter();
  const [hovered,       setHovered]       = useState(false);
  const [localStatus,   setLocalStatus]   = useState(c.status);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flashColor,    setFlashColor]    = useState<"red" | "green" | null>(null);

  const meta = NET_META[c.network] ?? { label: c.network, color: "#71717a" };

  const isHotLoss  = c.status === "ACTIVE" && c.roi < -20;
  const isWarmLoss = c.status === "ACTIVE" && c.roi < 0 && c.roi >= -20;
  const isScalable = c.status === "ACTIVE" && c.roi > 30 && c.spend > 100;

  const stripeColor = isHotLoss  ? "#f87171"
                    : isWarmLoss ? "#fbbf24"
                    : isScalable ? "#4ade80"
                    : "transparent";

  const baseRowBg = isHotLoss  ? "rgba(248,113,113,0.025)"
                  : isWarmLoss ? "rgba(251,191,36,0.018)"
                  : "transparent";

  const roiColor = c.roi > 30  ? "#4ade80"
                 : c.roi > 0   ? "#86efac"
                 : c.roi > -20 ? "#fbbf24"
                 : "#f87171";

  const rowBg = flashColor === "red"   ? "rgba(248,113,113,0.10)"
              : flashColor === "green" ? "rgba(74,222,128,0.08)"
              : hovered               ? "rgba(255,255,255,0.025)"
              : baseRowBg;

  async function doKill() {
    if (actionLoading) return;
    setActionLoading("kill");
    setFlashColor("red");
    try {
      await fetch(`/api/campaigns/${c.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
    } catch { /* silent */ }
    setTimeout(() => onRemove(c.id), 380);
    setActionLoading(null);
  }

  async function doScale() {
    if (actionLoading) return;
    setActionLoading("scale");
    setFlashColor("green");
    try {
      await fetch(`/api/campaigns/${c.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scale" }),
      });
    } catch { /* silent */ }
    setActionLoading(null);
    setTimeout(() => setFlashColor(null), 800);
  }

  async function doPause() {
    if (actionLoading) return;
    setActionLoading("pause");
    try {
      await fetch(`/api/campaigns/${c.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: localStatus === "PAUSED" ? "resume" : "pause" }),
      });
      setLocalStatus(prev => prev === "ACTIVE" ? "PAUSED" : "ACTIVE");
    } catch { /* silent */ }
    setActionLoading(null);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.32, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -1.5, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "stretch",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
        background: rowBg, transition: "background 0.18s",
        position: "relative" as const,
      }}
    >
      {/* Kill / scale flash overlay */}
      <AnimatePresence>
        {flashColor && (
          <motion.div
            key={flashColor}
            initial={{ opacity: 0.65 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: flashColor === "green" ? 0.75 : 0.45 }}
            style={{
              position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
              background: flashColor === "red"
                ? "rgba(248,113,113,0.22)"
                : "rgba(74,222,128,0.16)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Urgency stripe */}
      <div style={{
        width: 3, flexShrink: 0,
        background: stripeColor,
        opacity: stripeColor === "transparent" ? 0 : 0.7,
        transition: "background 0.3s",
      }} />

      {/* Content */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "3fr 1fr 1fr 1fr 1.3fr 0.9fr",
        padding: "14px 24px 14px 16px",
        alignItems: "center",
      }}>
        {/* Name + status dot */}
        <div
          onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, cursor: "pointer" }}
        >
          <motion.div
            animate={localStatus === "ACTIVE" ? { opacity: [1, 0.15, 1] } : {}}
            transition={{ duration: 2.2, repeat: Infinity }}
            style={{
              width: 4, height: 4, borderRadius: "50%", flexShrink: 0,
              background: localStatus === "ACTIVE" ? "#4ade80" : "rgba(255,255,255,0.18)",
              boxShadow: localStatus === "ACTIVE" ? "0 0 5px rgba(74,222,128,0.5)" : "none",
            }}
          />
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: "rgba(255,255,255,0.82)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
            transition: "color 0.15s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.82)"; }}
          >
            {c.name}
          </span>
        </div>

        {/* Network */}
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: meta.color }}>
          {meta.label}
        </span>

        {/* Spend */}
        <span style={{
          fontSize: 12, color: "rgba(255,255,255,0.32)",
          fontVariantNumeric: "tabular-nums", textAlign: "right" as const,
        }}>
          {fmtEuro(c.spend)}
        </span>

        {/* Revenue */}
        <span style={{
          fontSize: 12, fontWeight: 400, color: "#a78bfa",
          fontVariantNumeric: "tabular-nums", textAlign: "right" as const,
        }}>
          {fmtEuro(c.revenue)}
        </span>

        {/* Profit */}
        <span style={{
          fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          textAlign: "right" as const,
          color: c.profit > 0 ? "#4ade80" : c.profit < 0 ? "#f87171" : "rgba(255,255,255,0.18)",
        }}>
          {c.profit > 0 ? "+" : ""}{fmtEuro(c.profit)}
        </span>

        {/* ROI + slide-in actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          {/* ROI (fades when hovered) */}
          <motion.div
            animate={{ opacity: hovered ? 0 : 1 }}
            transition={{ duration: 0.1 }}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {c.roi !== 0 && (
              c.roi > 0
                ? <TrendingUp   size={9} color={roiColor} strokeWidth={1.5} />
                : <TrendingDown size={9} color={roiColor} strokeWidth={1.5} />
            )}
            <span style={{
              fontSize: 12, fontWeight: 700, color: roiColor, fontVariantNumeric: "tabular-nums",
            }}>
              {c.roi >= 0 ? "+" : ""}{c.roi.toFixed(0)}%
            </span>
          </motion.div>

          {/* Slide-in action buttons */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, x: 10, y: "-50%" }}
                animate={{ opacity: 1, x: 0,  y: "-50%" }}
                exit={{ opacity: 0, x: 7,     y: "-50%" }}
                transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  position: "absolute" as const, right: 0, top: "50%",
                  display: "flex", gap: 4, alignItems: "center",
                  paddingLeft: 16, paddingRight: 24,
                  background: "#17171e",
                  boxShadow: "-28px 0 18px 10px #17171e",
                  zIndex: 2,
                }}
              >
                {/* Kill — ACTIVE only */}
                {localStatus === "ACTIVE" && (
                  <motion.button
                    onClick={doKill}
                    disabled={!!actionLoading}
                    whileHover={{ scale: 1.06, boxShadow: "0 0 10px rgba(248,113,113,0.35)" }}
                    whileTap={{ scale: 0.88 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "4px 10px", borderRadius: 6,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                      background: "rgba(248,113,113,0.09)", border: "1px solid rgba(248,113,113,0.26)",
                      color: "#f87171", cursor: actionLoading ? "default" : "pointer",
                      opacity: actionLoading === "kill" ? 0.4 : 1,
                    }}
                  >
                    {actionLoading === "kill"
                      ? <RefreshCw size={9} />
                      : <><XCircle size={9} /> Kill</>}
                  </motion.button>
                )}

                {/* Pause / Resume */}
                <motion.button
                  onClick={doPause}
                  disabled={!!actionLoading}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.88 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "4px 10px", borderRadius: 6,
                    fontSize: 10, fontWeight: 500, letterSpacing: "0.03em",
                    background: "transparent",
                    border: localStatus === "PAUSED"
                      ? "1px solid rgba(74,222,128,0.22)"
                      : "1px solid rgba(255,255,255,0.09)",
                    color: localStatus === "PAUSED" ? "#4ade80" : "rgba(255,255,255,0.4)",
                    cursor: actionLoading ? "default" : "pointer",
                    opacity: actionLoading === "pause" ? 0.4 : 0.9,
                  }}
                >
                  {actionLoading === "pause"
                    ? <RefreshCw size={9} />
                    : localStatus === "PAUSED"
                    ? <><Play size={9} /> Resume</>
                    : <><Pause size={9} /> Pause</>}
                </motion.button>

                {/* Boost / Scale */}
                <motion.button
                  onClick={doScale}
                  disabled={!!actionLoading}
                  whileHover={{ scale: 1.06, boxShadow: "0 0 10px rgba(74,222,128,0.25)" }}
                  whileTap={{ scale: 0.88 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "4px 10px", borderRadius: 6,
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.03em",
                    background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)",
                    color: "#4ade80", cursor: actionLoading ? "default" : "pointer",
                    opacity: actionLoading === "scale" ? 0.4 : 1,
                  }}
                >
                  {actionLoading === "scale"
                    ? <RefreshCw size={9} />
                    : <><Zap size={9} /> Boost</>}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignsPnL({ initialCampaigns }: { initialCampaigns: CampaignRow[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  function handleRemove(id: string) {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }

  if (campaigns.length === 0) return null;

  const active     = campaigns.filter(c => c.status === "ACTIVE");
  const losing     = active.filter(c => c.roi < 0).sort((a, b) => a.roi - b.roi); // worst first
  const profitable = active.filter(c => c.roi >= 0).sort((a, b) => b.roi - a.roi); // best first
  const sorted     = [...losing, ...profitable];

  return (
    <div style={{
      background: "#17171e",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 18,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em",
          }}>
            Campaigns
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "2px 8px", borderRadius: 99,
          }}>
            P&L
          </span>
          {/* Urgency legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 4 }}>
            {[
              { color: "#f87171", label: "Stop"    },
              { color: "#fbbf24", label: "Watch"   },
              { color: "#4ade80", label: "Scale"   },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 3, height: 10, borderRadius: 2, background: color, opacity: 0.65 }} />
                <span style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
                  textTransform: "uppercase" as const, color: "rgba(255,255,255,0.2)",
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <Link
          href="/dashboard/campaigns"
          style={{
            fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.2)", textDecoration: "none",
            display: "flex", alignItems: "center", gap: 3,
            padding: "4px 12px", borderRadius: 99,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          View all <ChevronRight size={11} />
        </Link>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "3fr 1fr 1fr 1fr 1.3fr 0.9fr",
        padding: "10px 24px 8px 20px",
        marginLeft: 3,
      }}>
        {["Campaign", "Network", "Spend", "Revenue", "Profit", "ROI"].map((h, i) => (
          <span
            key={h}
            style={{ ...LABEL, ...(i >= 2 ? { textAlign: "right" as const } : {}) }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows with exit animation */}
      <AnimatePresence mode="popLayout" initial={false}>
        {sorted.map((c, i, arr) => (
          <Row
            key={c.id}
            c={c}
            isLast={i === arr.length - 1}
            index={i}
            onRemove={handleRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
