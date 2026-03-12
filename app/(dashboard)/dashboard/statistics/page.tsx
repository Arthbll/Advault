"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Percent, Award, BarChart2 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import DateRangePicker, { DateRange } from "@/components/ui/DateRangePicker";

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

interface Campaign { id: string; name: string; network: string; status: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number; }
interface SyncData {
  kpis: { totalSpend: string; totalRevenue: string; profit: string; roi: string; totalImpressions: number; totalClicks: number };
  byNetwork: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }>;
  campaigns: Campaign[];
  dateFrom: string; dateTo: string;
}

const NET_META: Record<string, { color: string; rgb: string }> = {
  EXOCLICK:     { color: "#F59E0B", rgb: "245,158,11"  },
  TRAFFICSTARS: { color: "#8B5CF6", rgb: "139,92,246"  },
  TRAFFICJUNKY: { color: "#00FF87", rgb: "0,255,135"   },
};

const Tip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; name: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#18181B", borderRadius: 12, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p style={{ color: "#52525B", marginBottom: 6, fontWeight: 500 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, marginBottom: 2, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {p.name}: {["spend","revenue","profit","Dépense","Revenue"].includes(p.dataKey) ? `$${Number(p.value).toFixed(2)}` : Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

function buildDailyChart(campaigns: Campaign[], dateFrom: string, dateTo: string) {
  const from = new Date(dateFrom), to = new Date(dateTo);
  const totalDays  = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400_000));
  const totalSpend = campaigns.reduce((s, c) => s + c.spend,   0);
  const totalRev   = campaigns.reduce((s, c) => s + c.revenue, 0);
  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(from); d.setDate(d.getDate() + i);
    const dd = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    const s = parseFloat((totalSpend / totalDays).toFixed(2));
    const r = parseFloat((totalRev   / totalDays).toFixed(2));
    return { date: dd, spend: s, revenue: r, profit: parseFloat((r - s).toFixed(2)) };
  });
}

// ── Mini stat card (bottom grid) ──────────────────────────────────────
function MiniStat({ label, value, sub, signalColor, icon, delay }: {
  label: string; value: string; sub?: string; signalColor?: string; icon: React.ReactNode; delay: number;
}) {
  const [hov, setHov] = useState(false);
  const rgb = signalColor === "#00FF87" ? "0,255,135" : signalColor === "#FF453A" ? "255,69,58" : "255,255,255";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      onHoverStart={() => setHov(true)} onHoverEnd={() => setHov(false)}
      style={{
        background: "#111113", borderRadius: 16, padding: "16px 18px",
        border: hov ? `1px solid rgba(${rgb},0.18)` : signalColor ? `1px solid rgba(${rgb},0.08)` : "1px solid rgba(255,255,255,0.06)",
        boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(${rgb},0.08)` : "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.18s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: signalColor ? `rgba(${rgb},0.1)` : "rgba(255,255,255,0.04)",
          border: signalColor ? `1px solid rgba(${rgb},0.15)` : "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</div>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#3F3F46" }}>{label}</span>
      </div>
      <p style={{
        fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em",
        color: signalColor ?? "#F5F5F7", lineHeight: 1, fontVariantNumeric: "tabular-nums",
        filter: signalColor && hov ? `drop-shadow(0 0 8px rgba(${rgb},0.4))` : "none",
        transition: "filter 0.2s",
      }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#27272A", marginTop: 5 }}>{sub}</p>}
    </motion.div>
  );
}

export default function StatisticsPage() {
  const [data,      setData]      = useState<SyncData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: daysAgo(90), to: new Date().toISOString().slice(0, 10) });

  const fetchData = useCallback(async (range?: DateRange) => {
    const r = range ?? dateRange;
    setLoading(true);
    try { const res = await fetch(`/api/stats?dateFrom=${r.from}&dateTo=${r.to}`); if (res.ok) setData(await res.json()); }
    finally { setLoading(false); }
  }, [dateRange]);

  async function handleSync() { setSyncing(true); await fetch("/api/sync", { method: "POST" }); await fetchData(); setSyncing(false); }
  function handleRangeChange(r: DateRange) { setDateRange(r); fetchData(r); }
  useEffect(() => { fetchData(); }, []);

  const spend   = data ? parseFloat(data.kpis.totalSpend)   : 0;
  const revenue = data ? parseFloat(data.kpis.totalRevenue) : 0;
  const profit  = data ? parseFloat(data.kpis.profit)       : 0;
  const roi     = data ? parseFloat(data.kpis.roi)          : 0;
  const impr    = data?.kpis.totalImpressions ?? 0;
  const clicks  = data?.kpis.totalClicks      ?? 0;
  const ctr     = impr > 0 ? ((clicks / impr) * 100).toFixed(2) : "0.00";
  const cpm     = impr > 0 ? ((spend / impr) * 1000).toFixed(3) : "0.000";

  const campaigns   = data?.campaigns ?? [];
  const sorted      = [...campaigns].sort((a, b) => b.spend - a.spend);
  const dailyChart  = campaigns.length > 0 ? buildDailyChart(campaigns, dateRange.from, dateRange.to) : [];
  const networkData = data ? Object.entries(data.byNetwork).map(([network, v]) => ({
    network, spend: parseFloat(v.spend.toFixed(2)), revenue: parseFloat(v.revenue.toFixed(2)),
    profit: parseFloat((v.revenue - v.spend).toFixed(2)),
    roi: v.spend > 0 ? ((v.revenue - v.spend) / v.spend) * 100 : 0,
    impressions: v.impressions, clicks: v.clicks,
  })) : [];

  // Best network by ROI
  const bestNet = networkData.length > 0 ? networkData.reduce((a, b) => a.roi > b.roi ? a : b) : null;

  const totalDays = Math.max(1, Math.round((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400_000));
  const xInterval = totalDays <= 14 ? 1 : totalDays <= 30 ? 4 : totalDays <= 60 ? 7 : 14;

  const CARD_BG = { background: "#111113", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)" };

  return (
    <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 4 }}>
            {campaigns.length} campagne{campaigns.length !== 1 ? "s" : ""} · toutes sources
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", margin: 0, lineHeight: 1 }}>
              Statistiques
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DateRangePicker value={dateRange} onChange={handleRangeChange} />
              <motion.button
                onClick={handleSync} disabled={syncing}
                whileHover={!syncing ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 16px rgba(0,255,135,0.2)" } : {}}
                whileTap={!syncing ? { scale: 0.96 } : {}}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 12,
                  border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.08)", color: "#00FF87",
                  fontSize: 13, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer",
                  opacity: syncing ? 0.7 : 1, transition: "box-shadow 0.2s, border-color 0.2s",
                }}>
                <motion.div animate={syncing ? { rotate: 360 } : {}} transition={syncing ? { repeat: Infinity, duration: 0.7, ease: "linear" } : {}}>
                  <RefreshCw size={12} strokeWidth={2} />
                </motion.div>
                {syncing ? "Sync…" : "Synchroniser"}
              </motion.button>
              <div style={{
                display: "flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 12,
                background: roi >= 0 ? "rgba(0,255,135,0.08)" : "rgba(255,69,58,0.08)",
                color: roi >= 0 ? "#00FF87" : "#FF453A",
                border: `1px solid ${roi >= 0 ? "rgba(0,255,135,0.15)" : "rgba(255,69,58,0.15)"}`,
                fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              }}>
                {roi >= 0 ? <TrendingUp size={12} strokeWidth={2} /> : <TrendingDown size={12} strokeWidth={2} />}
                {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
              </div>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
              <RefreshCw size={18} strokeWidth={1.5} style={{ color: "#3F3F46" }} />
            </motion.div>
          </div>
        ) : (
          <>
            {/* ── Hero — 2 grandes cartes Profit + ROI ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                {
                  label: "Profit Net",
                  value: `${profit >= 0 ? "+" : ""}$${Math.abs(profit).toFixed(2)}`,
                  sub: `${spend.toFixed(2)} dépensé · ${revenue.toFixed(2)} généré`,
                  color: profit >= 0 ? "#00FF87" : "#FF453A",
                  rgb:   profit >= 0 ? "0,255,135" : "255,69,58",
                  trend: profit >= 0 ? "up" : "down",
                  delay: 0,
                },
                {
                  label: "ROI Global",
                  value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
                  sub: "(Profit ÷ Dépenses) × 100",
                  color: roi >= 0 ? "#00FF87" : "#FF453A",
                  rgb:   roi >= 0 ? "0,255,135" : "255,69,58",
                  trend: roi >= 0 ? "up" : "down",
                  delay: 0.05,
                },
              ].map(({ label, value, sub, color, rgb, trend, delay }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay, duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    background: "#111113", borderRadius: 20, padding: "24px 28px",
                    border: `1px solid rgba(${rgb},0.1)`,
                    boxShadow: `0 1px 3px rgba(0,0,0,0.5), 0 4px 24px rgba(0,0,0,0.4), 0 0 40px rgba(${rgb},0.04)`,
                    position: "relative", overflow: "hidden",
                  }}
                >
                  {/* Top accent */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, rgba(${rgb},0.6), transparent)` }} />
                  {/* Glow orb */}
                  <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `rgba(${rgb},0.05)`, filter: "blur(20px)", pointerEvents: "none" }} />

                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.15)`,
                    }}>
                      {trend === "up"
                        ? <TrendingUp  size={16} strokeWidth={1.5} style={{ color, filter: `drop-shadow(0 0 5px rgba(${rgb},0.6))` }} />
                        : <TrendingDown size={16} strokeWidth={1.5} style={{ color, filter: `drop-shadow(0 0 5px rgba(${rgb},0.6))` }} />
                      }
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3F3F46" }}>{label}</span>
                  </div>

                  <p style={{
                    fontSize: 38, fontWeight: 700, letterSpacing: "-0.04em",
                    color, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                    filter: `drop-shadow(0 0 12px rgba(${rgb},0.25))`,
                    marginBottom: 8,
                  }}>{value}</p>
                  <p style={{ fontSize: 12, color: "#3F3F46" }}>{sub}</p>
                </motion.div>
              ))}
            </div>

            {/* ── 6 mini stats ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <MiniStat delay={0.10} icon={<DollarSign size={11} strokeWidth={1.5} style={{ color: "#3F3F46" }} />}  label="Dépense"    value={`$${spend.toFixed(2)}`} />
              <MiniStat delay={0.13} icon={<DollarSign size={11} strokeWidth={1.5} style={{ color: "#3F3F46" }} />}  label="Revenue"    value={`$${revenue.toFixed(2)}`} />
              <MiniStat delay={0.16} icon={<Eye         size={11} strokeWidth={1.5} style={{ color: "#3F3F46" }} />} label="Impressions"
                value={impr >= 1e6 ? `${(impr/1e6).toFixed(2)}M` : impr >= 1e3 ? `${(impr/1e3).toFixed(1)}K` : String(impr)} />
              <MiniStat delay={0.19} icon={<MousePointer size={11} strokeWidth={1.5} style={{ color: "#3F3F46" }} />} label="Clics"
                value={clicks >= 1e3 ? `${(clicks/1e3).toFixed(1)}K` : String(clicks)} sub={`${campaigns.length} campagnes`} />
              <MiniStat delay={0.22} icon={<Percent size={11} strokeWidth={1.5} style={{ color: "#3F3F46" }} />} label="CTR" value={`${ctr}%`} sub="Clics / Impressions" />
              <MiniStat delay={0.25} icon={<DollarSign size={11} strokeWidth={1.5} style={{ color: "#3F3F46" }} />} label="CPM" value={`$${cpm}`} sub="Coût / 1 000 impressions" />
            </div>

            {/* ── Spotlight par réseau ── */}
            {networkData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <BarChart2 size={13} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.5))" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F5F7" }}>Performance par réseau</p>
                  {bestNet && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "rgba(255,159,10,0.1)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.2)" }}>
                      <Award size={9} strokeWidth={2} /> Meilleur ROI : {bestNet.network}
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${networkData.length}, 1fr)`, gap: 10 }}>
                  {networkData.map((net, i) => {
                    const nm = NET_META[net.network] ?? { color: "#52525B", rgb: "82,82,91" };
                    const isBest = bestNet?.network === net.network;
                    const maxSpend = Math.max(...networkData.map(n => n.spend), 1);
                    const spendPct = (net.spend / maxSpend) * 100;
                    const revPct   = Math.min(100, (net.revenue / maxSpend) * 100);
                    return (
                      <motion.div
                        key={net.network}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.07 }}
                        style={{
                          background: "#111113", borderRadius: 20, padding: "20px 22px",
                          border: isBest ? `1px solid rgba(${nm.rgb},0.2)` : "1px solid rgba(255,255,255,0.06)",
                          boxShadow: isBest ? `0 0 24px rgba(${nm.rgb},0.06), 0 4px 16px rgba(0,0,0,0.4)` : "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
                          position: "relative", overflow: "hidden",
                        }}
                      >
                        {isBest && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${nm.color}, transparent)` }} />}
                        {/* Network name */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `rgba(${nm.rgb},0.12)`, border: `1px solid rgba(${nm.rgb},0.18)`, fontSize: 9, fontWeight: 800, color: nm.color }}>
                              {net.network.slice(0,2)}
                            </div>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>{net.network}</p>
                              <p style={{ fontSize: 10, color: "#3F3F46", marginTop: 1 }}>{campaigns.filter(c => c.network === net.network).length} camp.</p>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em",
                            color: net.roi >= 0 ? "#00FF87" : "#FF453A",
                            filter: `drop-shadow(0 0 5px rgba(${net.roi >= 0 ? "0,255,135" : "255,69,58"},0.3))`,
                          }}>
                            {net.roi >= 0 ? "+" : ""}{net.roi.toFixed(1)}%
                          </span>
                        </div>

                        {/* Spend / Revenue bars */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { label: "Dépense", pct: spendPct, color: "#FF453A", rgb: "255,69,58", value: `$${net.spend.toFixed(0)}` },
                            { label: "Revenue", pct: revPct,   color: "#00FF87", rgb: "0,255,135", value: `$${net.revenue.toFixed(0)}` },
                          ].map(({ label, pct, color, rgb, value }) => (
                            <div key={label}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 10, color: "#3F3F46" }}>{label}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
                              </div>
                              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.4 + i * 0.07 }}
                                  style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, rgba(${rgb},0.4), ${color})`, boxShadow: `0 0 6px rgba(${rgb},0.3)` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Area chart Dépense vs Revenue ── */}
            {dailyChart.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
                style={{ ...CARD_BG, padding: "24px 24px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>Dépense vs Revenue</p>
                    <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 3 }}>{totalDays} jours · {dateRange.from} → {dateRange.to}</p>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {([["#FF453A", "Dépense"], ["#00FF87", "Revenue"]] as const).map(([color, label]) => (
                      <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#3F3F46" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 4px ${color}80` }} />{label}
                      </span>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#FF453A" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#FF453A" stopOpacity={0}    />
                      </linearGradient>
                      <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00FF87" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#00FF87" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: "#3F3F46", fontSize: 10 }} axisLine={false} tickLine={false} interval={xInterval} />
                    <YAxis tick={{ fill: "#3F3F46", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="spend"   stroke="#FF453A" strokeWidth={1.5} fill="url(#gS)" dot={false} name="Dépense" />
                    <Area type="monotone" dataKey="revenue" stroke="#00FF87" strokeWidth={1.5} fill="url(#gR)" dot={false} name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* ── Bar chart par réseau ── */}
            {networkData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}
                style={{ ...CARD_BG, padding: "24px 24px 16px" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F7", marginBottom: 6 }}>Dépense & Revenue par réseau</p>
                <p style={{ fontSize: 11, color: "#3F3F46", marginBottom: 20 }}>Comparatif toutes sources</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={networkData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={6}>
                    <XAxis dataKey="network" tick={{ fill: "#3F3F46", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#3F3F46", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="spend"   fill="#FF453A" fillOpacity={0.7} radius={[4,4,0,0]} name="Dépense" />
                    <Bar dataKey="revenue" fill="#00FF87" fillOpacity={0.7} radius={[4,4,0,0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* ── Tableau détaillé ── */}
            {sorted.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}
                style={{ ...CARD_BG, overflow: "hidden" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>Détail par campagne</p>
                    <p style={{ fontSize: 11, color: "#3F3F46", marginTop: 3 }}>{sorted.length} campagne{sorted.length > 1 ? "s" : ""} · triées par dépense</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 90px 90px 80px 70px 70px 80px", padding: "10px 24px", background: "rgba(255,255,255,0.02)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3F3F46" }}>
                  <span>Campagne</span><span>Réseau</span>
                  <span style={{ textAlign: "right" }}>Dépense</span><span style={{ textAlign: "right" }}>Revenue</span>
                  <span style={{ textAlign: "right" }}>Impr.</span><span style={{ textAlign: "right" }}>CTR</span>
                  <span style={{ textAlign: "right" }}>CPM</span><span style={{ textAlign: "right" }}>ROI</span>
                </div>
                {sorted.map((c, i) => {
                  const cCtr = c.impressions > 0 ? `${((c.clicks/c.impressions)*100).toFixed(2)}%` : "—";
                  const cCpm = c.impressions > 0 ? `$${((c.spend/c.impressions)*1000).toFixed(3)}` : "—";
                  const cRoi = c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0;
                  const nm   = NET_META[c.network] ?? { color: "#52525B", rgb: "82,82,91" };
                  const isTopRoi = sorted.length > 0 && cRoi === Math.max(...sorted.map(x => x.spend > 0 ? ((x.revenue - x.spend)/x.spend)*100 : 0));
                  return (
                    <div key={c.id}
                      style={{ display: "grid", gridTemplateColumns: "2fr 120px 90px 90px 80px 70px 70px 80px", padding: "13px 24px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", fontSize: 12, color: "#52525B", transition: "background 0.1s", borderLeft: `2px solid rgba(${nm.rgb},0.3)` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 16 }}>
                        <motion.span animate={c.status === "ACTIVE" ? { opacity: [1, 0.15, 1], scale: [1, 0.6, 1] } : {}} transition={{ duration: 2, repeat: Infinity }}
                          style={{ width: 5, height: 5, borderRadius: "50%", background: c.status === "ACTIVE" ? "#00FF87" : "#27272A", flexShrink: 0, boxShadow: c.status === "ACTIVE" ? "0 0 4px rgba(0,255,135,0.6)" : "none" }} />
                        <span style={{ fontWeight: 500, color: "#E4E4E7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        {isTopRoi && cRoi > 0 && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "rgba(255,159,10,0.12)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.2)", flexShrink: 0 }}>BEST</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: nm.color, boxShadow: `0 0 3px rgba(${nm.rgb},0.5)` }} />
                        <span style={{ fontWeight: 600, color: nm.color, fontSize: 11 }}>{c.network}</span>
                      </div>
                      <span style={{ textAlign: "right", color: "#FF453A", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${c.spend.toFixed(2)}</span>
                      <span style={{ textAlign: "right", color: "#00FF87", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${c.revenue.toFixed(2)}</span>
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.impressions >= 1000 ? `${(c.impressions/1000).toFixed(0)}K` : c.impressions}</span>
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cCtr}</span>
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{cCpm}</span>
                      <span style={{ textAlign: "right", fontWeight: 700, color: cRoi >= 0 ? "#00FF87" : "#FF453A", fontVariantNumeric: "tabular-nums" }}>{cRoi >= 0 ? "+" : ""}{cRoi.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </motion.div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", ...CARD_BG }}>
                <p style={{ fontSize: 14, color: "#3F3F46", marginBottom: 16 }}>Aucune donnée pour cette période</p>
                <motion.button
                  onClick={handleSync}
                  whileHover={{ y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" }} whileTap={{ scale: 0.97 }}
                  style={{ padding: "9px 20px", borderRadius: 12, border: "1px solid rgba(0,255,135,0.2)", background: "rgba(0,255,135,0.08)", color: "#00FF87", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Synchroniser
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
