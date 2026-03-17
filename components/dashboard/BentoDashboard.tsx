"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import WorldMap from "./WorldMap";

// ─── Geo types ────────────────────────────────────────────────────────────────

interface GeoDot {
  label: string; countryCode: string;
  x: number; y: number;
  impressions: string; clicks: string; spent: string;
  size: number; delay: string;
}

function countryFlag(code: string): string {
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join("");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Totals {
  totalSpend: number; totalRevenue: number; totalProfit: number; roi: number;
  totalImps: number; totalClicks: number; totalConvs: number; ctr: number;
}
interface NetworkRow { network: string; spend: number; revenue: number; profit: number; roi: number; campaigns: number; impressions?: number; }
interface ChartPoint  { date: string; spend: number; revenue: number; profit: number; }

interface DashboardData {
  totals: Totals;
  chartData: ChartPoint[];
  networkBreakdown: NetworkRow[];
  activeCampaigns: number;
}

interface Props extends DashboardData {
  /* formatted strings from server (initial render) */
  profitLabel: string; roiLabel: string; spendLabel: string;
  convLabel: string; spendSub: string; convSub: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NET_META: Record<string, { label: string; color: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9" },
  VOLUUM:       { label: "Voluum",       color: "#10b981" },
  BEMOB:        { label: "Bemob",        color: "#f43f5e" },
};

const CARD: React.CSSProperties = {
  background: "#17171e",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 18,
  overflow: "hidden",
};

const BAR_COLORS = ["#8b5cf6", "#fbbf24", "#0ea5e9", "#10b981", "#f59e0b"];

// ─── Typography helpers ───────────────────────────────────────────────────────

/** Section label — tiny uppercase */
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "#3f3f46",
};

/** Big metric number */
function BigNum({ value, color = "rgba(255,255,255,0.92)", size = 38 }: {
  value: string | number; color?: string; size?: number;
}) {
  return (
    <span style={{
      fontSize: size, fontWeight: 200,
      letterSpacing: "-0.04em", lineHeight: 1,
      color, display: "block",
    }}>
      {value}
    </span>
  );
}

/** Zero-aware display — shows "—" at low opacity when value is 0 */
function zeroFmt(n: number, fmt: (n: number) => string): string {
  return n === 0 ? "—" : fmt(n);
}
function zeroColor(n: number, activeColor: string): string {
  return n === 0 ? "rgba(255,255,255,0.18)" : activeColor;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtEuro(n: number) {
  if (n === 0) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}
function fmtPct(n: number) {
  if (n === 0) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
function fmtBig(n: number) {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoToday()   { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}

interface DateRange { from: string; to: string; label: string; }

const PRESETS: DateRange[] = [
  { from: isoToday(),      to: isoToday(),      label: "Auj."  },
  { from: daysAgo(7),      to: isoToday(),      label: "7J"    },
  { from: daysAgo(30),     to: isoToday(),      label: "30J"   },
  { from: firstOfMonth(),  to: isoToday(),      label: "Mois"  },
];

// ─── Date Range Selector ──────────────────────────────────────────────────────

function DateSelector({ range, onChange, loading }: {
  range: DateRange;
  onChange: (r: DateRange) => void;
  loading: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo,   setCustomTo]   = useState(range.to);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
      {/* Preset pills */}
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => { onChange(p); setCustomOpen(false); }}
          style={{
            padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
            fontWeight: range.label === p.label ? 600 : 400,
            background: range.label === p.label ? "#ffffff" : "transparent",
            color:      range.label === p.label ? "#000000" : "rgba(113,113,122,0.9)",
            border:     range.label === p.label ? "none"    : "1px solid rgba(255,255,255,0.08)",
            transition: "all 0.15s",
          }}
        >
          {p.label}
        </button>
      ))}

      {/* Custom button */}
      <button
        onClick={() => setCustomOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
          fontWeight: range.label === "Custom" ? 600 : 400,
          background: range.label === "Custom" ? "#ffffff" : "rgba(255,255,255,0.04)",
          color:      range.label === "Custom" ? "#000000" : "rgba(113,113,122,0.9)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Calendar size={11} />
        {range.label === "Custom" ? `${range.from} → ${range.to}` : "Custom"}
      </button>

      {/* Loading spinner */}
      {loading && (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={13} color="#52525b" />
        </motion.div>
      )}

      {/* Custom dropdown */}
      <AnimatePresence>
        {customOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 100,
              background: "#1a1a22",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              minWidth: 260,
            }}
          >
            <p style={{ ...LABEL, marginBottom: 10 }}>Plage personnalisée</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="date" value={customFrom} max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", colorScheme: "dark", outline: "none" }}
              />
              <span style={{ color: "#3f3f46", fontSize: 12 }}>→</span>
              <input type="date" value={customTo} min={customFrom} max={isoToday()}
                onChange={e => setCustomTo(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", colorScheme: "dark", outline: "none" }}
              />
            </div>
            <button
              onClick={() => { onChange({ from: customFrom, to: customTo, label: "Custom" }); setCustomOpen(false); }}
              style={{ width: "100%", padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)", cursor: "pointer" }}
            >
              Appliquer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stagger ─────────────────────────────────────────────────────────────────

function s(i: number) {
  return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: i * 0.07 } };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BentoDashboard(props: Props) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: daysAgo(30), to: isoToday(), label: "30J" });
  const [data, setData]           = useState<DashboardData>({
    totals:           props.totals,
    chartData:        props.chartData,
    networkBreakdown: props.networkBreakdown,
    activeCampaigns:  props.activeCampaigns,
  });
  const [loading, setLoading] = useState(false);
  const [geoDots, setGeoDots] = useState<GeoDot[]>([]);

  const fetchGeo = useCallback(async (range: DateRange) => {
    try {
      const res = await fetch(`/api/dashboard/geo?dateFrom=${range.from}&dateTo=${range.to}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.dots?.length) {
        setGeoDots(json.dots.map((d: GeoDot, i: number) => ({
          ...d, delay: `${(i * 0.35).toFixed(1)}s`,
        })));
      }
    } catch { /* silently ignore */ }
  }, []);

  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const [statsRes] = await Promise.all([
        fetch(`/api/dashboard/stats?dateFrom=${range.from}&dateTo=${range.to}`),
        fetchGeo(range),
      ]);
      if (statsRes.ok) setData(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [fetchGeo]);

  // Initial geo fetch on mount
  useEffect(() => { fetchGeo(dateRange); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDateChange(range: DateRange) {
    setDateRange(range);
    fetchData(range);
  }

  const { totals, chartData, networkBreakdown, activeCampaigns } = data;
  const profitPos   = totals.totalProfit >= 0;
  const profitColor = zeroColor(totals.totalProfit, profitPos ? "#4ade80" : "#f87171");
  const revenueColor = zeroColor(totals.totalRevenue, "#a78bfa");

  return (
    <div style={{ padding: "18px 22px 48px", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Title + Date Selector ──────────────────────────────────────────── */}
      <motion.div {...s(0)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <p style={LABEL}>
            {activeCampaigns > 0 ? `${activeCampaigns} campagne${activeCampaigns > 1 ? "s" : ""} actives` : "Aucune campagne active"}
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 300, color: "rgba(255,255,255,0.92)", margin: "4px 0 0", letterSpacing: "-0.03em" }}>
            Overview
          </h1>
        </div>
        <DateSelector range={dateRange} onChange={handleDateChange} loading={loading} />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 1  —  3 colonnes
      ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "5fr 3fr 4fr", gap: 10 }}>

        {/* ── Card 1 : Profit Net chart ────────────────────────────────────── */}
        <motion.div {...s(1)} style={{ ...CARD, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>Profit Net</span>
            {/* Legend */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {[{ c: "#a78bfa", l: "Revenue" }, { c: profitColor, l: "Profit" }].map(({ c, l }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
                  <span style={{ fontSize: 10, color: "#52525b" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Big numbers */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 16 }}>
            <div>
              <p style={{ ...LABEL, marginBottom: 5 }}>Profit</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BigNum value={fmtEuro(totals.totalProfit)} color={profitColor} size={34} />
                <span style={{
                  padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                  background: profitPos ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                  color: profitColor, opacity: totals.totalProfit === 0 ? 0.4 : 1,
                }}>
                  {fmtPct(totals.roi)}
                </span>
              </div>
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 20 }}>
              <p style={{ ...LABEL, marginBottom: 5 }}>Revenue</p>
              <BigNum value={fmtEuro(totals.totalRevenue)} color={revenueColor} size={24} />
            </div>
            <div>
              <p style={{ ...LABEL, marginBottom: 5 }}>Spend</p>
              <BigNum value={fmtEuro(totals.totalSpend)} color={zeroColor(totals.totalSpend, "#fbbf24")} size={24} />
            </div>
          </div>

          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#3f3f46" }} tickLine={false} axisLine={false}
                interval={chartData.length > 20 ? Math.floor(chartData.length / 5) : 0} />
              <Tooltip
                formatter={(v: number, key: string) => [`€${Math.round(v).toLocaleString("fr-FR")}`, key === "profit" ? "Profit" : "Revenue"]}
                labelFormatter={(l: string) => l}
                contentStyle={{ background: "#1e1e26", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 11 }}
                labelStyle={{ color: "#71717a", marginBottom: 4 }}
                itemStyle={{ color: "#a1a1aa" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#8b5cf6"  fill="url(#gRev)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="profit"  stroke="#4ade80"  fill="url(#gPro)" strokeWidth={2}   dot={false} activeDot={{ r: 3, fill: "#4ade80", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* ── Card 2 : Campagnes ───────────────────────────────────────────── */}
        <motion.div {...s(2)} style={{ ...CARD, padding: "18px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>Campagnes</span>
            <span style={{ ...LABEL, padding: "4px 9px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.07)" }}>
              {dateRange.label}
            </span>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
            <div>
              <p style={{ ...LABEL, marginBottom: 6 }}>Actives</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <BigNum value={activeCampaigns === 0 ? "—" : activeCampaigns} color={zeroColor(activeCampaigns, "rgba(255,255,255,0.92)")} size={52} />
                {activeCampaigns > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 8px", borderRadius: 99,
                    background: "rgba(74,222,128,0.08)",
                    border: "1px solid rgba(74,222,128,0.15)" }}>
                    <span className="live-dot" style={{ width: 5, height: 5 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#4ade80", textTransform: "uppercase" }}>Live</span>
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>campagnes en cours</p>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
              <p style={{ ...LABEL, marginBottom: 8 }}>Dépenses</p>
              <div style={{
                background: "rgba(251,191,36,0.06)", borderRadius: 12, padding: "12px 14px",
                border: "1px solid rgba(251,191,36,0.1)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <BigNum value={fmtEuro(totals.totalSpend)} color={zeroColor(totals.totalSpend, "#fbbf24")} size={22} />
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,191,36,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", opacity: 0.7 }} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Card 3 : Impressions ─────────────────────────────────────────── */}
        <motion.div {...s(3)} style={{ ...CARD, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>Impressions</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={{ ...LABEL, marginBottom: 5 }}>Total période</p>
            <BigNum value={fmtBig(totals.totalImps)} color={zeroColor(totals.totalImps, "rgba(255,255,255,0.92)")} size={36} />
          </div>

          {/* Two stat boxes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Clics",  value: fmtBig(totals.totalClicks), color: "#a78bfa", bg: "rgba(139,92,246,0.08)", n: totals.totalClicks },
              { label: "Conv.",  value: fmtBig(totals.totalConvs),  color: "#4ade80",  bg: "rgba(74,222,128,0.07)",  n: totals.totalConvs  },
            ].map(({ label, value, color, bg, n }) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: "10px 12px", border: `1px solid ${bg.replace("0.08", "0.12").replace("0.07", "0.1")}` }}>
                <p style={{ ...LABEL, marginBottom: 5 }}>{label}</p>
                <BigNum value={zeroFmt(n, () => value)} color={zeroColor(n, color)} size={20} />
              </div>
            ))}
          </div>

          {/* CTR */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={LABEL}>CTR</p>
              <span style={{ fontSize: 12, fontWeight: 500, color: zeroColor(totals.ctr, "#fbbf24"), letterSpacing: "-0.02em" }}>
                {totals.ctr === 0 ? "—" : `${totals.ctr.toFixed(2)}%`}
              </span>
            </div>
            {/* CTR visual track */}
            <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.05)", marginBottom: 14 }}>
              <div style={{ width: totals.ctr > 0 ? `${Math.min(totals.ctr * 10, 100)}%` : "0%", height: "100%", borderRadius: 99, background: zeroColor(totals.ctr, "#fbbf24"), transition: "width 0.6s ease" }} />
            </div>

            {/* Per-network horizontal bars */}
            {(networkBreakdown.length > 0 ? networkBreakdown : []).slice(0, 3).map((row, i) => {
              const meta  = NET_META[row.network] ?? { label: row.network, color: "#71717a" };
              const maxImp = Math.max(...networkBreakdown.map(r => r.impressions ?? 0), 1);
              const pct = row.impressions ? Math.round((row.impressions / maxImp) * 100) : 0;
              return (
                <div key={row.network} style={{ marginBottom: i < 2 ? 8 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{meta.label}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtBig(row.impressions ?? 0)}
                    </span>
                  </div>
                  <div style={{ height: 2, borderRadius: 99, background: "rgba(255,255,255,0.05)" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: meta.color, opacity: 0.6, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 2  —  4 colonnes
      ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1.2fr", gap: 10 }}>

        {/* ── Card 4 : Top réseaux ─────────────────────────────────────────── */}
        <motion.div {...s(4)} style={{ ...CARD, padding: "16px 18px" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginBottom: 16 }}>Réseaux</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(networkBreakdown.length > 0
              ? [...networkBreakdown].sort((a, b) => b.profit - a.profit).slice(0, 4)
              : [
                  { network: "EXOCLICK",     profit: 0, campaigns: 0 } as NetworkRow,
                  { network: "TRAFFICSTARS", profit: 0, campaigns: 0 } as NetworkRow,
                  { network: "TRAFFICJUNKY", profit: 0, campaigns: 0 } as NetworkRow,
                ]
            ).map((row) => {
              const meta  = NET_META[row.network] ?? { label: row.network, color: "#71717a" };
              const isPos = row.profit >= 0;
              return (
                <div key={row.network} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${meta.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, boxShadow: `0 0 5px ${meta.color}` }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(212,212,216,0.9)", margin: 0 }}>{meta.label}</p>
                      <p style={{ ...LABEL, marginTop: 1 }}>{row.campaigns > 0 ? `${row.campaigns} camp.` : "—"}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: row.profit === 0 ? "rgba(255,255,255,0.18)" : (isPos ? "#4ade80" : "#f87171") }}>
                    {row.profit === 0 ? "—" : `${row.profit >= 0 ? "+" : ""}${row.profit.toFixed(0)}€`}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Card 5 : ROI ─────────────────────────────────────────────────── */}
        <motion.div {...s(5)} style={{ ...CARD, padding: "16px 18px" }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginBottom: 16 }}>ROI Global</p>

          {/* Circle */}
          <div style={{
            width: 120, height: 120, borderRadius: "50%", margin: "0 auto 16px",
            background: totals.roi === 0
              ? "rgba(255,255,255,0.03)"
              : profitPos
                ? "radial-gradient(circle at 35% 35%, rgba(74,222,128,0.2), rgba(74,222,128,0.04))"
                : "radial-gradient(circle at 35% 35%, rgba(248,113,113,0.2), rgba(248,113,113,0.04))",
            border: `1px solid ${totals.roi === 0 ? "rgba(255,255,255,0.06)" : profitPos ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.18)"}`,
            display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 26, fontWeight: 200, letterSpacing: "-0.04em", color: totals.roi === 0 ? "rgba(255,255,255,0.18)" : profitColor }}>
              {fmtPct(totals.roi)}
            </span>
            <span style={LABEL}>ROI</span>
          </div>

          {/* Bars */}
          {[
            { label: "Revenue", value: fmtEuro(totals.totalRevenue), color: "#a78bfa", n: totals.totalRevenue, total: Math.max(totals.totalRevenue, totals.totalSpend) },
            { label: "Spend",   value: fmtEuro(totals.totalSpend),   color: "#fbbf24", n: totals.totalSpend,   total: Math.max(totals.totalRevenue, totals.totalSpend) },
          ].map(({ label, value, color, n, total }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={LABEL}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: zeroColor(n, color) }}>{value}</span>
              </div>
              <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.05)" }}>
                <div style={{ width: total > 0 ? `${(n / total) * 100}%` : "0%", height: "100%", borderRadius: 99, background: zeroColor(n, color) }} />
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Card 6 : World Map ───────────────────────────────────────────── */}
        <motion.div {...s(6)} style={{ ...CARD, height: 300 }}>
          <WorldMap dots={geoDots} />
        </motion.div>

        {/* ── Card 7 : Country breakdown ───────────────────────────────────── */}
        <motion.div {...s(7)} style={{ ...CARD, padding: "16px 18px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ ...LABEL, marginBottom: 4 }}>Worldwide</p>
                <BigNum value={fmtBig(totals.totalImps)} size={34} color={zeroColor(totals.totalImps, "rgba(255,255,255,0.92)")} />
              </div>
            </div>
            <p style={{ ...LABEL, marginTop: 3 }}>Impressions worldwide</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {geoDots.length > 0
              ? geoDots.slice(0, 5).map(({ countryCode, label, impressions }, i, arr) => (
                  <div key={countryCode} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{countryFlag(countryCode)}</span>
                      <span style={{ fontSize: 12, color: "rgba(212,212,216,0.8)" }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{impressions}</span>
                  </div>
                ))
              : /* Skeleton while loading */
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 18, height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)", flexShrink: 0 }} />
                    <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.04)", flex: 1, maxWidth: `${75 - i * 12}%` }} />
                  </div>
                ))
            }
          </div>
        </motion.div>
      </div>
    </div>
  );
}
