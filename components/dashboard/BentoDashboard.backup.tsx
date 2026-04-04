"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import WorldMap from "./WorldMap";
import AlertBanner, { AlertCampaign } from "./AlertBanner";
import { CampaignRow } from "./CampaignsPnL";

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
  totalImps: number; totalClicks: number; totalConvs: number; ctr: number; ctrNoPop: number;
}
interface NetworkRow {
  network: string; spend: number; revenue: number; profit: number; roi: number;
  campaigns: number; impressions?: number;
}
interface ChartPoint { date: string; spend: number; revenue: number; profit: number; }

interface DashboardData {
  totals: Totals;
  chartData: ChartPoint[];
  networkBreakdown: NetworkRow[];
  activeCampaigns: number;
  alerts: AlertCampaign[];
  topCampaigns: CampaignRow[];
  trend: number | null;
}

interface Props extends DashboardData {
  profitLabel: string; roiLabel: string; spendLabel: string;
  convLabel: string; spendSub: string; convSub: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const NET_META: Record<string, { label: string; color: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b" },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6" },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9" },
  VOLUUM:       { label: "Voluum",       color: "#10b981" },
  BEMOB:        { label: "Bemob",        color: "#f43f5e" },
};

const BASE_SHADOW = "0 1px 0 rgba(255,255,255,0.055) inset, 0 -1px 0 rgba(0,0,0,0.25) inset, 0 16px 40px rgba(0,0,0,0.22)";

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.028)",
  border: "1px solid rgba(255,255,255,0.058)",
  borderRadius: 20,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: BASE_SHADOW,
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 500,
  textTransform: "uppercase", letterSpacing: "0.11em",
  color: "rgba(255,255,255,0.22)",
  margin: 0,
};

// ─── Typography helpers ───────────────────────────────────────────────────────

function BigNum({ value, color = "rgba(255,255,255,0.9)", size = 38 }: {
  value: string | number; color?: string; size?: number;
}) {
  return (
    <span style={{
      fontSize: size, fontWeight: 100,
      letterSpacing: "-0.04em", lineHeight: 1,
      color, display: "block",
    }}>
      {value}
    </span>
  );
}

function MoneyNum({ value, color, size = 28 }: { value: number; color: string; size?: number }) {
  if (value === 0) return <BigNum value="—" color="rgba(255,255,255,0.1)" size={size} />;
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(abs);
  return (
    <span style={{ fontSize: size, fontWeight: 100, letterSpacing: "-0.04em", lineHeight: 1, color, display: "block" }}>
      {sign && <span style={{ opacity: 0.45 }}>{sign}</span>}
      <span style={{ opacity: 0.18 }}>€</span>
      {formatted}
    </span>
  );
}

function zeroFmt(n: number, fmt: (n: number) => string): string {
  return n === 0 ? "—" : fmt(n);
}
function zeroColor(n: number, activeColor: string): string {
  return n === 0 ? "rgba(255,255,255,0.1)" : activeColor;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

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

function isoToday() { return new Date().toISOString().slice(0, 10); }
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
  { from: isoToday(),     to: isoToday(),  label: "Auj." },
  { from: daysAgo(7),     to: isoToday(),  label: "7J"   },
  { from: daysAgo(30),    to: isoToday(),  label: "30J"  },
  { from: firstOfMonth(), to: isoToday(),  label: "Mois" },
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
      {PRESETS.map(p => {
        const active = range.label === p.label;
        return (
          <button
            key={p.label}
            onClick={() => { onChange(p); setCustomOpen(false); }}
            style={{
              padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
              fontWeight: active ? 600 : 400,
              background: active ? "rgba(255,255,255,0.88)" : "transparent",
              color:      active ? "#0a0a0f" : "rgba(255,255,255,0.28)",
              border:     active ? "none" : "1px solid rgba(255,255,255,0.07)",
              transition: "all 0.15s",
            }}
          >
            {p.label}
          </button>
        );
      })}

      <button
        onClick={() => setCustomOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 99, fontSize: 12, cursor: "pointer",
          fontWeight: range.label === "Custom" ? 600 : 400,
          background: range.label === "Custom" ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.04)",
          color:      range.label === "Custom" ? "#0a0a0f" : "rgba(255,255,255,0.28)",
          border: "1px solid rgba(255,255,255,0.07)",
          transition: "all 0.15s",
        }}
      >
        <Calendar size={11} />
        {range.label === "Custom" ? `${range.from} → ${range.to}` : "Custom"}
      </button>

      {loading && (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={13} color="rgba(255,255,255,0.18)" />
        </motion.div>
      )}

      <AnimatePresence>
        {customOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 100,
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 16, padding: "16px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
              minWidth: 260,
            }}
          >
            <p style={{ ...LABEL, marginBottom: 10 }}>Plage personnalisée</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="date" value={customFrom} max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#fff", colorScheme: "dark", outline: "none" }}
              />
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>→</span>
              <input type="date" value={customTo} min={customFrom} max={isoToday()}
                onChange={e => setCustomTo(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#fff", colorScheme: "dark", outline: "none" }}
              />
            </div>
            <button
              onClick={() => { onChange({ from: customFrom, to: customTo, label: "Custom" }); setCustomOpen(false); }}
              style={{ width: "100%", padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.16)", cursor: "pointer" }}
            >
              Appliquer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stagger helper ───────────────────────────────────────────────────────────

function s(i: number) {
  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.52, delay: i * 0.065, ease: [0.25, 0.46, 0.45, 0.94] as const },
  };
}

// ─── Stat pill (Row 2) ────────────────────────────────────────────────────────

function StatPill({ label, children, glow, delay }: {
  label: string; children: React.ReactNode; glow?: string; delay: number;
}) {
  return (
    <motion.div
      {...s(delay)}
      whileHover={{ y: -2, boxShadow: `${BASE_SHADOW}, 0 0 0 1px rgba(255,255,255,0.09)` }}
      style={{
        ...CARD,
        padding: "20px 22px",
        ...(glow ? { boxShadow: `${BASE_SHADOW}, ${glow}` } : {}),
        transition: "box-shadow 0.2s ease",
      }}
    >
      <p style={{ ...LABEL, marginBottom: 10 }}>{label}</p>
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BentoDashboard(props: Props) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: daysAgo(30), to: isoToday(), label: "30J" });
  const [data, setData] = useState<DashboardData>({
    totals:           props.totals,
    chartData:        props.chartData,
    networkBreakdown: props.networkBreakdown,
    activeCampaigns:  props.activeCampaigns,
    alerts:           props.alerts,
    topCampaigns:     props.topCampaigns,
    trend:            props.trend,
  });
  const [loading, setLoading]     = useState(false);
  const [geoDots, setGeoDots]     = useState<GeoDot[]>([]);
  const [mapNetwork, setMapNetwork] = useState("ALL");
  const [excludePop, setExcludePop] = useState(false);

  const fetchGeo = useCallback(async (range: DateRange, network = mapNetwork) => {
    try {
      const res = await fetch(`/api/dashboard/geo?dateFrom=${range.from}&dateTo=${range.to}&network=${network}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.dots?.length) {
        setGeoDots(json.dots.map((d: GeoDot, i: number) => ({ ...d, delay: `${(i * 0.35).toFixed(1)}s` })));
      }
    } catch { /* silent */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => { fetchGeo(dateRange, mapNetwork); }, [mapNetwork]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchGeo(dateRange); }, []);               // eslint-disable-line react-hooks/exhaustive-deps

  function handleDateChange(range: DateRange) {
    setDateRange(range);
    fetchData(range);
  }

  const { totals, chartData, networkBreakdown, activeCampaigns, alerts, trend } = data;
  const profitPos   = totals.totalProfit >= 0;
  const profitColor = totals.totalProfit === 0
    ? "rgba(255,255,255,0.1)"
    : profitPos ? "#4ade80" : "#f87171";

  // Dynamic glow that bleeds from the hero card
  const heroGlow = totals.totalProfit === 0
    ? ""
    : profitPos
      ? "0 0 140px rgba(74,222,128,0.055)"
      : "0 0 140px rgba(248,113,113,0.07)";

  const ctrVal = excludePop ? totals.ctrNoPop : totals.ctr;

  return (
    <div style={{ padding: "22px 26px 64px", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Alert Banner ───────────────────────────────────────────────────── */}
      {alerts.length > 0 && <AlertBanner initialAlerts={alerts} />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div {...s(0)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <p style={LABEL}>
            {activeCampaigns > 0
              ? `${activeCampaigns} campagne${activeCampaigns > 1 ? "s" : ""} actives`
              : "Aucune campagne active"}
          </p>
          <h1 style={{ fontSize: 23, fontWeight: 200, color: "rgba(255,255,255,0.82)", margin: "3px 0 0", letterSpacing: "-0.03em" }}>
            Overview
          </h1>
        </div>
        <DateSelector range={dateRange} onChange={handleDateChange} loading={loading} />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO — Profit + Chart (pleine largeur)
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        {...s(1)}
        whileHover={{ boxShadow: `${BASE_SHADOW}, ${heroGlow}, 0 0 0 1px rgba(255,255,255,0.07)` }}
        style={{
          ...CARD,
          boxShadow: `${BASE_SHADOW}${heroGlow ? `, ${heroGlow}` : ""}`,
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          overflow: "hidden",
          minHeight: 220,
        }}
      >
        {/* Left — big number */}
        <div style={{
          padding: "28px 30px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          borderRight: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div>
            <p style={{ ...LABEL, marginBottom: 14 }}>Profit Net</p>
            <MoneyNum value={totals.totalProfit} color={profitColor} size={54} />

            {/* ROI + Trend */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <span style={{
                padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: profitPos ? "rgba(74,222,128,0.09)" : "rgba(248,113,113,0.09)",
                color: profitColor,
                border: `1px solid ${profitPos ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)"}`,
                opacity: totals.totalProfit === 0 ? 0.3 : 1,
                letterSpacing: "-0.01em",
              }}>
                {fmtPct(totals.roi)}
              </span>
              {trend !== null && (
                <span style={{
                  fontSize: 10, fontWeight: 500,
                  color: trend >= 0 ? "#4ade80" : "#f87171",
                  opacity: 0.55, letterSpacing: "0.02em",
                }}>
                  {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(0)}% vs préc.
                </span>
              )}
            </div>
          </div>

          {/* Secondary: Revenue + Spend */}
          <div style={{ display: "flex", gap: 0, marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ flex: 1 }}>
              <p style={{ ...LABEL, marginBottom: 7 }}>Revenue</p>
              <MoneyNum value={totals.totalRevenue} color="rgba(167,139,250,0.85)" size={19} />
            </div>
            <div style={{ flex: 1, borderLeft: "1px solid rgba(255,255,255,0.04)", paddingLeft: 16 }}>
              <p style={{ ...LABEL, marginBottom: 7 }}>Dépenses</p>
              <MoneyNum value={totals.totalSpend} color="rgba(251,191,36,0.75)" size={19} />
            </div>
          </div>
        </div>

        {/* Right — chart */}
        <div style={{ position: "relative", minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 28, right: 24, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={profitPos ? "#4ade80" : "#f87171"} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={profitPos ? "#4ade80" : "#f87171"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.16)" }}
                tickLine={false} axisLine={false}
                interval={chartData.length > 20 ? Math.floor(chartData.length / 6) : 0}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, key: any) => [`€${Math.round(Number(v)).toLocaleString("fr-FR")}`, key === "profit" ? "Profit" : "Revenue"]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(l: any) => String(l)}
                contentStyle={{ background: "#0d0d14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, fontSize: 11, boxShadow: "0 16px 40px rgba(0,0,0,0.7)" }}
                labelStyle={{ color: "rgba(255,255,255,0.25)", marginBottom: 4 }}
                itemStyle={{ color: "rgba(255,255,255,0.65)" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#8b5cf6"                                    fill="url(#gRev)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="profit"  stroke={profitPos ? "#4ade80" : "#f87171"}          fill="url(#gPro)" strokeWidth={2}   dot={false}
                activeDot={{ r: 3, fill: profitPos ? "#4ade80" : "#f87171", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Chart legend — top right */}
          <div style={{ position: "absolute", top: 18, right: 20, display: "flex", gap: 14, alignItems: "center" }}>
            {[{ c: "#8b5cf6", l: "Revenue" }, { c: profitPos ? "#4ade80" : "#f87171", l: "Profit" }].map(({ c, l }) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 2 — 4 métriques secondaires
      ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>

        {/* Campagnes actives */}
        <StatPill
          label="Campagnes"
          delay={2}
          glow={activeCampaigns > 0 ? "0 0 50px rgba(74,222,128,0.04)" : undefined}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <BigNum
              value={activeCampaigns === 0 ? "—" : activeCampaigns}
              color={zeroColor(activeCampaigns, "rgba(255,255,255,0.88)")}
              size={42}
            />
            {activeCampaigns > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 99,
                background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.14)",
              }}>
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#4ade80", textTransform: "uppercase" }}>Live</span>
              </span>
            )}
          </div>
          <p style={{ ...LABEL, marginTop: 8 }}>actives</p>
        </StatPill>

        {/* Impressions */}
        <StatPill label="Impressions" delay={3}>
          <BigNum
            value={fmtBig(totals.totalImps)}
            color={zeroColor(totals.totalImps, "rgba(255,255,255,0.88)")}
            size={42}
          />
          <p style={{ ...LABEL, marginTop: 8 }}>sur la période</p>
        </StatPill>

        {/* Clics + CTR */}
        <StatPill label="Clics" delay={4}>
          <BigNum
            value={fmtBig(totals.totalClicks)}
            color={zeroColor(totals.totalClicks, "rgba(255,255,255,0.88)")}
            size={42}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p style={LABEL}>CTR</p>
              <span style={{ fontSize: 11, fontWeight: 400, color: zeroColor(ctrVal, "#fbbf24"), letterSpacing: "-0.01em" }}>
                {ctrVal === 0 ? "—" : `${ctrVal.toFixed(2)}%`}
              </span>
            </div>
            {/* Exclude pop toggle */}
            <button
              onClick={() => setExcludePop(v => !v)}
              title="Exclure formats Pop"
              style={{
                padding: "2px 7px", borderRadius: 99, cursor: "pointer",
                background: excludePop ? "rgba(251,191,36,0.09)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${excludePop ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", color: excludePop ? "#fbbf24" : "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
                −Pop
              </span>
            </button>
          </div>
        </StatPill>

        {/* Conversions */}
        <StatPill label="Conversions" delay={5}>
          <BigNum
            value={zeroFmt(totals.totalConvs, fmtBig)}
            color={zeroColor(totals.totalConvs, "rgba(255,255,255,0.88)")}
            size={42}
          />
          <p style={{ ...LABEL, marginTop: 8 }}>sur la période</p>
        </StatPill>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 3 — Réseaux + World Map
      ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: 10 }}>

        {/* Networks */}
        <motion.div
          {...s(6)}
          whileHover={{ y: -1, boxShadow: `${BASE_SHADOW}, 0 0 0 1px rgba(255,255,255,0.08)` }}
          style={{ ...CARD, padding: "22px 24px" }}
        >
          <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.65)", marginBottom: 22, letterSpacing: "-0.01em" }}>
            Réseaux
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(networkBreakdown.length > 0
              ? [...networkBreakdown].sort((a, b) => b.profit - a.profit).slice(0, 5)
              : [
                  { network: "EXOCLICK",     profit: 0, campaigns: 0, spend: 0, revenue: 0, roi: 0 } as NetworkRow,
                  { network: "TRAFFICSTARS", profit: 0, campaigns: 0, spend: 0, revenue: 0, roi: 0 } as NetworkRow,
                  { network: "TRAFFICJUNKY", profit: 0, campaigns: 0, spend: 0, revenue: 0, roi: 0 } as NetworkRow,
                ]
            ).map((row) => {
              const meta  = NET_META[row.network] ?? { label: row.network, color: "#71717a" };
              const isPos = row.profit >= 0;
              return (
                <div key={row.network} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: `${meta.color}10`,
                      border: `1px solid ${meta.color}20`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, boxShadow: `0 0 8px ${meta.color}99` }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 300, color: "rgba(255,255,255,0.65)", margin: 0, letterSpacing: "-0.01em" }}>
                        {meta.label}
                      </p>
                      <p style={{ ...LABEL, marginTop: 2 }}>
                        {row.campaigns > 0 ? `${row.campaigns} camp.` : "—"}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: 14, fontWeight: 200, letterSpacing: "-0.03em",
                      color: row.profit === 0 ? "rgba(255,255,255,0.1)" : (isPos ? "#4ade80" : "#f87171"),
                    }}>
                      {row.profit === 0 ? "—" : `${row.profit >= 0 ? "+" : ""}${row.profit.toFixed(0)}€`}
                    </span>
                    {row.profit !== 0 && (
                      <p style={{ ...LABEL, marginTop: 2 }}>{fmtPct(row.roi)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* World Map — plus grande */}
        <motion.div
          {...s(7)}
          whileHover={{ y: -1, boxShadow: `${BASE_SHADOW}, 0 0 0 1px rgba(255,255,255,0.07)` }}
          style={{ ...CARD, overflow: "hidden", minHeight: 320 }}
        >
          <WorldMap
            dots={geoDots}
            activeNetwork={mapNetwork}
            onNetworkChange={(n) => setMapNetwork(n)}
          />
        </motion.div>

      </div>

    </div>
  );
}
