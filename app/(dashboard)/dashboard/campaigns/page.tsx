"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Zap, RefreshCw, Pause, Play, Award, Activity, Plus } from "lucide-react";
import CampaignCreateModal from "@/components/campaigns/CampaignCreateModal";

interface Campaign {
  id: string; name: string; network: string; status: string;
  spend: number; revenue: number; impressions: number; clicks: number; conversions: number;
}

const STATUS_CFG: Record<string, { label: string; color: string; rgb: string }> = {
  ACTIVE: { label: "Actif",  color: "#00FF87", rgb: "0,255,135"   },
  PAUSED: { label: "Pausé",  color: "#F59E0B", rgb: "245,158,11"  },
  KILLED: { label: "Killed", color: "#FF453A", rgb: "255,69,58"   },
  DRAFT:  { label: "Draft",  color: "#52525B", rgb: "82,82,91"    },
};

const NET_META: Record<string, { color: string; rgb: string; label: string }> = {
  EXOCLICK:     { color: "#F59E0B", rgb: "245,158,11", label: "ExoClick"     },
  TRAFFICSTARS: { color: "#8B5CF6", rgb: "139,92,246", label: "TrafficStars" },
  TRAFFICJUNKY: { color: "#00FF87", rgb: "0,255,135",  label: "TrafficJunky" },
};

const FILTERS = ["ALL", "ACTIVE", "PAUSED", "KILLED"] as const;
type Filter = typeof FILTERS[number];

export default function CampaignsPage() {
  const [campaigns,   setCampaigns]   = useState<Campaign[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [acting,      setActing]      = useState<string | null>(null);
  const [filter,      setFilter]      = useState<Filter>("ALL");
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);

  async function fetchCampaigns() {
    const res = await fetch("/api/sync");
    if (res.ok) { const j = await res.json(); setCampaigns(j.campaigns ?? []); }
    setLoading(false);
  }
  async function handleSync() { setSyncing(true); await fetch("/api/sync", { method: "POST" }); await fetchCampaigns(); setSyncing(false); }
  async function doAction(id: string, action: "pause" | "resume" | "kill") {
    setActing(id + action);
    try {
      const res  = await fetch(`/api/campaigns/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const json = await res.json();
      if (json.ok) { setCampaigns(p => p.map(c => c.id === id ? { ...c, status: json.status } : c)); setToast({ msg: `${action === "kill" ? "Kill" : action === "pause" ? "Pause" : "Reprise"} appliqué`, ok: true }); }
      else setToast({ msg: json.error ?? "Erreur", ok: false });
    } catch { setToast({ msg: "Erreur réseau", ok: false }); }
    setActing(null);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => { fetchCampaigns(); }, []);

  const filtered   = filter === "ALL" ? campaigns : campaigns.filter(c => c.status === filter);
  const counts     = { ALL: campaigns.length, ACTIVE: campaigns.filter(c => c.status==="ACTIVE").length, PAUSED: campaigns.filter(c => c.status==="PAUSED").length, KILLED: campaigns.filter(c => c.status==="KILLED").length };
  const totalSpend   = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const globalRoi    = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  // Best ROI campaign
  const bestCamp = campaigns.length > 0
    ? campaigns.reduce((a, b) => {
        const roiA = a.spend > 0 ? (a.revenue - a.spend) / a.spend : -Infinity;
        const roiB = b.spend > 0 ? (b.revenue - b.spend) / b.spend : -Infinity;
        return roiA >= roiB ? a : b;
      })
    : null;

  // Network stats
  const networkStats = Object.entries(NET_META).map(([key, meta]) => {
    const nets = campaigns.filter(c => c.network === key);
    const s = nets.reduce((a, c) => a + c.spend, 0);
    const r = nets.reduce((a, c) => a + c.revenue, 0);
    return { key, ...meta, count: nets.length, active: nets.filter(c => c.status === "ACTIVE").length, spend: s, revenue: r, roi: s > 0 ? ((r - s) / s) * 100 : 0 };
  });

  const maxNetSpend = Math.max(...networkStats.map(n => n.spend), 1);

  return (
    <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: "#00FF87" }}>{counts.ACTIVE}</span> active{counts.ACTIVE !== 1 ? "s" : ""} sur {counts.ALL} campagnes
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", margin: 0, lineHeight: 1 }}>
              Campagnes
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Créer une campagne */}
              <motion.button
                onClick={() => setShowCreate(true)}
                whileHover={{ y: -1, boxShadow: "0 0 0 1px rgba(245,158,11,0.3), 0 4px 16px rgba(245,158,11,0.15)" }}
                whileTap={{ scale: 0.96 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 12,
                  border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.08)", color: "#F59E0B",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                Créer
              </motion.button>
              <motion.button
                onClick={handleSync} disabled={syncing}
                whileHover={!syncing ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 16px rgba(0,255,135,0.2)" } : {}}
                whileTap={!syncing ? { scale: 0.96 } : {}}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 12,
                  border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.08)", color: "#00FF87",
                  fontSize: 13, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer",
                  opacity: syncing ? 0.7 : 1, transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                <motion.div animate={syncing ? { rotate: 360 } : {}} transition={syncing ? { repeat: Infinity, duration: 0.7, ease: "linear" } : {}}>
                  <RefreshCw size={12} strokeWidth={2} />
                </motion.div>
                {syncing ? "Sync…" : "Synchroniser"}
              </motion.button>
              {/* Global ROI pill */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 12,
                background: globalRoi >= 0 ? "rgba(0,255,135,0.08)" : "rgba(255,69,58,0.08)",
                color: globalRoi >= 0 ? "#00FF87" : "#FF453A",
                border: `1px solid ${globalRoi >= 0 ? "rgba(0,255,135,0.15)" : "rgba(255,69,58,0.15)"}`,
                fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              }}>
                {globalRoi >= 0 ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingDown size={12} strokeWidth={2} />}
                {globalRoi >= 0 ? "+" : ""}{globalRoi.toFixed(1)}%
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Mini KPI bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}
        >
          {[
            { label: "Actives",  value: counts.ACTIVE,               color: "#00FF87", rgb: "0,255,135" },
            { label: "Dépenses", value: `$${totalSpend.toFixed(0)}`, color: "#FF453A", rgb: "255,69,58" },
            { label: "Revenues", value: `$${totalRevenue.toFixed(0)}`, color: "#00FF87", rgb: "0,255,135" },
            { label: "ROI moy.", value: `${globalRoi >= 0 ? "+" : ""}${globalRoi.toFixed(1)}%`,
              color: globalRoi >= 0 ? "#00FF87" : "#FF453A",
              rgb:   globalRoi >= 0 ? "0,255,135" : "255,69,58" },
          ].map(({ label, value, color, rgb }) => (
            <div key={label} style={{
              background: "#111113", borderRadius: 14, padding: "14px 18px",
              border: `1px solid rgba(${rgb},0.07)`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, rgba(${rgb},0.3), transparent)` }} />
              <p style={{ fontSize: 10, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 6 }}>{label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color, fontVariantNumeric: "tabular-nums", filter: `drop-shadow(0 0 6px rgba(${rgb},0.25))` }}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Spotlight meilleure campagne ── */}
        {bestCamp && bestCamp.spend > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Award size={12} strokeWidth={1.5} style={{ color: "#FF9F0A", filter: "drop-shadow(0 0 4px rgba(255,159,10,0.5))" }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7" }}>Meilleure campagne</p>
              <p style={{ fontSize: 11, color: "#3F3F46", marginLeft: 2 }}>— ROI le plus élevé</p>
            </div>
            {(() => {
              const roi = bestCamp.spend > 0 ? ((bestCamp.revenue - bestCamp.spend) / bestCamp.spend) * 100 : 0;
              const nm  = NET_META[bestCamp.network] ?? { color: "#52525B", rgb: "82,82,91", label: bestCamp.network };
              const revPct = Math.min(100, bestCamp.spend > 0 ? (bestCamp.revenue / bestCamp.spend) * 100 : 0);
              return (
                <div style={{
                  background: "#111113", borderRadius: 20, padding: "20px 24px",
                  border: "1px solid rgba(255,159,10,0.12)",
                  boxShadow: "0 0 32px rgba(255,159,10,0.04), 0 4px 16px rgba(0,0,0,0.4)",
                  position: "relative", overflow: "hidden",
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(255,159,10,0.5), transparent)" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {/* Network badge */}
                    <div style={{
                      width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 800, color: nm.color,
                      background: `rgba(${nm.rgb},0.12)`, border: `1px solid rgba(${nm.rgb},0.2)`,
                      boxShadow: `0 0 12px rgba(${nm.rgb},0.15)`,
                    }}>
                      {nm.label.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F7", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bestCamp.name}</p>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(255,159,10,0.12)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.2)", flexShrink: 0 }}>BEST ROI</span>
                        <motion.span animate={{ opacity: [1, 0.2, 1], scale: [1, 0.6, 1] }} transition={{ duration: 2, repeat: Infinity }}
                          style={{ width: 6, height: 6, borderRadius: "50%", background: "#00FF87", flexShrink: 0, boxShadow: "0 0 5px rgba(0,255,135,0.7)" }} />
                      </div>
                      {/* Revenue vs Spend bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${revPct}%` }}
                            transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.4 }}
                            style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, rgba(0,255,135,0.4), #00FF87)", boxShadow: "0 0 6px rgba(0,255,135,0.4)" }}
                          />
                        </div>
                        <span style={{ fontSize: 10, color: "#3F3F46", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          ${bestCamp.spend.toFixed(0)} → ${bestCamp.revenue.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: roi >= 0 ? "#00FF87" : "#FF453A", fontVariantNumeric: "tabular-nums", margin: 0, filter: `drop-shadow(0 0 10px rgba(${roi >= 0 ? "0,255,135" : "255,69,58"},0.35))` }}>
                      {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                    </p>
                    <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 3 }}>ROI</p>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* ── Réseaux publicitaires ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <Activity size={12} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.4))" }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7" }}>Par réseau</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {networkStats.map((net, i) => (
              <motion.div
                key={net.key}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 + i * 0.06 }}
                style={{
                  background: "#111113", borderRadius: 18, padding: "18px 20px",
                  border: net.active > 0 ? `1px solid rgba(${net.rgb},0.12)` : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: net.active > 0 ? `0 0 20px rgba(${net.rgb},0.04), 0 4px 16px rgba(0,0,0,0.4)` : "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35)",
                  position: "relative", overflow: "hidden",
                }}
              >
                {net.active > 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, rgba(${net.rgb},0.5), transparent)` }} />}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: net.color, background: `rgba(${net.rgb},0.12)`, border: `1px solid rgba(${net.rgb},0.18)` }}>
                      {net.label.slice(0, 2)}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>{net.label}</p>
                      <p style={{ fontSize: 10, color: "#3F3F46", marginTop: 2 }}>
                        <span style={{ color: net.active > 0 ? "#00FF87" : "#3F3F46" }}>{net.active}</span> active{net.active !== 1 ? "s" : ""} / {net.count}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: net.roi >= 0 ? "#00FF87" : "#FF453A",
                    filter: `drop-shadow(0 0 4px rgba(${net.roi >= 0 ? "0,255,135" : "255,69,58"},0.3))`,
                  }}>
                    {net.roi >= 0 ? "+" : ""}{net.roi.toFixed(1)}%
                  </span>
                </div>
                {/* Spend bar */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#3F3F46" }}>Dépense</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#FF453A", fontVariantNumeric: "tabular-nums" }}>${net.spend.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(net.spend / maxNetSpend) * 100}%` }}
                      transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.3 + i * 0.07 }}
                      style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, rgba(255,69,58,0.4), #FF453A)", boxShadow: "0 0 4px rgba(255,69,58,0.3)" }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#3F3F46" }}>Revenue</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#00FF87", fontVariantNumeric: "tabular-nums" }}>${net.revenue.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.min(100, (net.revenue / maxNetSpend) * 100)}%` }}
                      transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.35 + i * 0.07 }}
                      style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, rgba(0,255,135,0.4), #00FF87)", boxShadow: "0 0 4px rgba(0,255,135,0.3)" }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Filter pills ── */}
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map(f => {
            const active = filter === f;
            const cfg = STATUS_CFG[f as keyof typeof STATUS_CFG];
            return (
              <motion.button key={f} onClick={() => setFilter(f)} whileTap={{ scale: 0.95 }}
                style={{
                  padding: "7px 14px", borderRadius: 99,
                  border: active ? `1px solid rgba(${f === "ALL" ? "0,255,135" : cfg?.rgb ?? "255,255,255"},0.2)` : "1px solid rgba(255,255,255,0.06)",
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  background: active ? `rgba(${f === "ALL" ? "0,255,135" : cfg?.rgb ?? "255,255,255"},0.08)` : "rgba(255,255,255,0.03)",
                  color: active ? (f === "ALL" ? "#00FF87" : cfg?.color ?? "#F5F5F7") : "#3F3F46",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {f === "ALL" ? "Tous" : STATUS_CFG[f]?.label ?? f}{" "}
                <span style={{ fontSize: 10, opacity: 0.6 }}>{counts[f]}</span>
              </motion.button>
            );
          })}
        </div>

        {/* ── Table ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{
            background: "#111113", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20, overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {/* Col headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 110px 80px 1fr 80px 100px",
            padding: "11px 20px", background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3F3F46",
          }}>
            <span>Campagne</span><span>Réseau</span><span>Statut</span>
            <span style={{ paddingLeft: 8 }}>Dépense → Revenue</span>
            <span style={{ textAlign: "right" }}>ROI</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
                <RefreshCw size={18} strokeWidth={1.5} style={{ color: "#3F3F46" }} />
              </motion.div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#3F3F46", fontSize: 13 }}>
              Aucune campagne {filter !== "ALL" ? `avec le statut "${STATUS_CFG[filter]?.label}"` : ""}
            </div>
          ) : (
            filtered.map((c, i) => {
              const roi    = c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0;
              const cfg    = STATUS_CFG[c.status] ?? STATUS_CFG.DRAFT;
              const nm     = NET_META[c.network] ?? { color: "#52525B", rgb: "82,82,91", label: c.network };
              const isPend = acting?.startsWith(c.id);
              const isBest = bestCamp?.id === c.id && roi > 0;
              // Ratio bar: revenue vs spend
              const maxVal  = Math.max(c.spend, c.revenue, 1);
              const spendPct = (c.spend / maxVal) * 100;
              const revPct   = (c.revenue / maxVal) * 100;

              return (
                <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  style={{
                    display: "grid", gridTemplateColumns: "2fr 110px 80px 1fr 80px 100px",
                    padding: "14px 20px", alignItems: "center",
                    borderTop: "1px solid rgba(255,255,255,0.03)",
                    borderLeft: `2px solid rgba(${nm.rgb},0.35)`,
                    fontSize: 13, transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `rgba(${nm.rgb},0.025)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 12 }}>
                    <motion.span
                      animate={c.status === "ACTIVE" ? { opacity: [1, 0.15, 1], scale: [1, 0.6, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0, boxShadow: c.status === "ACTIVE" ? `0 0 5px rgba(${cfg.rgb},0.7)` : "none" }}
                    />
                    <span style={{ fontWeight: 500, color: "#E4E4E7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    {isBest && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "rgba(255,159,10,0.1)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.2)", flexShrink: 0 }}>BEST</span>}
                  </div>

                  {/* Network */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: nm.color, background: `rgba(${nm.rgb},0.12)`, border: `1px solid rgba(${nm.rgb},0.18)` }}>
                      {nm.label.slice(0, 2)}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: nm.color }}>{nm.label.slice(0, 6)}</span>
                  </div>

                  {/* Status */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, width: "fit-content",
                    background: `rgba(${cfg.rgb},0.1)`, color: cfg.color, border: `1px solid rgba(${cfg.rgb},0.15)`,
                    letterSpacing: "0.03em",
                  }}>{cfg.label}</span>

                  {/* Ratio bar */}
                  <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: "#FF453A" }}>${c.spend.toFixed(0)}</span>
                      <span style={{ color: "#00FF87" }}>${c.revenue.toFixed(0)}</span>
                    </div>
                    <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                      {/* Spend bar (red, base) */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${spendPct}%`, background: "rgba(255,69,58,0.4)", borderRadius: 99 }} />
                      {/* Revenue bar (green, overlay) */}
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${revPct}%` }}
                        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.3 + i * 0.02 }}
                        style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99, background: "linear-gradient(90deg, rgba(0,255,135,0.3), rgba(0,255,135,0.7))", boxShadow: "0 0 4px rgba(0,255,135,0.3)" }}
                      />
                    </div>
                  </div>

                  {/* ROI */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                    {roi >= 0 ? <TrendingUp size={10} strokeWidth={2} style={{ color: "#00FF87" }} /> : <TrendingDown size={10} strokeWidth={2} style={{ color: "#FF453A" }} />}
                    <span style={{ fontWeight: 700, color: roi >= 0 ? "#00FF87" : "#FF453A", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                      {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    {c.status === "ACTIVE" && (
                      <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }} onClick={() => doAction(c.id, "pause")} disabled={!!isPend}
                        style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isPend ? 0.4 : 1 }}
                        title="Pause">
                        <Pause size={10} strokeWidth={1.5} style={{ color: "#52525B" }} />
                      </motion.button>
                    )}
                    {c.status === "PAUSED" && (
                      <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }} onClick={() => doAction(c.id, "resume")} disabled={!!isPend}
                        style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(0,255,135,0.15)", background: "rgba(0,255,135,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isPend ? 0.4 : 1 }}
                        title="Reprendre">
                        <Play size={10} strokeWidth={1.5} style={{ color: "#00FF87" }} />
                      </motion.button>
                    )}
                    {c.status !== "KILLED" && (
                      <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }} onClick={() => doAction(c.id, "kill")} disabled={!!isPend}
                        style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,69,58,0.15)", background: "rgba(255,69,58,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isPend ? 0.4 : 1 }}
                        title="Kill">
                        <Zap size={10} strokeWidth={1.5} style={{ color: "#FF453A" }} />
                      </motion.button>
                    )}
                    {c.status === "KILLED" && <Minus size={12} strokeWidth={1.5} style={{ color: "#27272A" }} />}
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>

        {/* Campaign Create Modal */}
        <AnimatePresence>
          {showCreate && (
            <CampaignCreateModal
              onClose={() => setShowCreate(false)}
              onCreated={() => { fetchCampaigns(); setToast({ msg: "Campagne créée avec succès ✓", ok: true }); setTimeout(() => setToast(null), 3000); }}
            />
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
              style={{
                position: "fixed", bottom: 24, right: 24,
                padding: "12px 20px", borderRadius: 14, fontSize: 13, fontWeight: 600,
                background: toast.ok ? "rgba(0,255,135,0.12)" : "rgba(255,69,58,0.12)",
                color: toast.ok ? "#00FF87" : "#FF453A",
                border: toast.ok ? "1px solid rgba(0,255,135,0.2)" : "1px solid rgba(255,69,58,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100, backdropFilter: "blur(12px)",
              }}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
