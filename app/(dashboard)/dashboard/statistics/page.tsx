"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Download, ChevronLeft } from "lucide-react";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG   = "#0d0d10";
const C    = (op: number) => `rgba(255,255,255,${op})`;
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const TONES = {
  violet:  { border: "rgba(167,139,250,0.16)", bg: "rgba(139,92,246,0.08)",  text: "rgba(221,214,254,1)", line: "rgba(196,181,253,0.95)" },
  amber:   { border: "rgba(251,191,36,0.16)",  bg: "rgba(245,158,11,0.08)",  text: "rgba(253,230,138,1)", line: "rgba(252,211,77,0.9)"   },
  emerald: { border: "rgba(52,211,153,0.16)",  bg: "rgba(16,185,129,0.08)",  text: "rgba(167,243,208,1)", line: "rgba(110,231,183,0.92)" },
  sky:     { border: "rgba(56,189,248,0.16)",  bg: "rgba(14,165,233,0.08)",  text: "rgba(186,230,253,1)", line: "rgba(125,211,252,0.9)"  },
} as const;
type Tone = keyof typeof TONES;

const NET_BADGE: Record<string, { border: string; bg: string; text: string }> = {
  EXOCLICK:     { border: "rgba(251,191,36,0.16)",  bg: "rgba(245,158,11,0.08)",  text: "rgba(253,230,138,1)" },
  TRAFFICSTARS: { border: "rgba(167,139,250,0.16)", bg: "rgba(139,92,246,0.08)",  text: "rgba(221,214,254,1)" },
  TRAFFICJUNKY: { border: "rgba(56,189,248,0.16)",  bg: "rgba(14,165,233,0.08)",  text: "rgba(186,230,253,1)" },
};

const NET_LABELS: Record<string, string> = {
  EXOCLICK: "ExoClick", TRAFFICSTARS: "TrafficStars", TRAFFICJUNKY: "TrafficJunky",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashTotals {
  totalSpend: number; totalRevenue: number; totalProfit: number;
  roi: number; totalImps: number; totalClicks: number;
  totalConvs: number; ctr: number; ctrNoPop: number;
}
interface ChartPt  { date: string; spend: number; revenue: number; profit: number }
interface NetItem  { network: string; spend: number; revenue: number; profit: number; roi: number; campaigns: number }
interface DashStats {
  totals: DashTotals; chartData: ChartPt[]; networkBreakdown: NetItem[]; activeCampaigns: number;
}
interface Campaign {
  id: string; name: string; network: string; status: string;
  spend: number; revenue: number; impressions: number; clicks: number; conversions: number;
}
interface SyncData {
  kpis: { totalSpend: string; totalRevenue: string; profit: string; roi: string; totalImpressions: number; totalClicks: number };
  byNetwork: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }>;
  campaigns: Campaign[];
  dateFrom: string; dateTo: string;
}
interface DateRange { from: string; to: string; label: string }
type SortKey = "spend" | "revenue" | "impressions" | "clicks" | "conversions";

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_CAMPAIGNS: Campaign[] = [
  { id:"1", name:"Adult Dating — Push — US — Tier1",    network:"EXOCLICK",     status:"ACTIVE", spend:4100, revenue:6800, impressions:12400000, clicks:18300, conversions:205 },
  { id:"2", name:"Casino — Native — UK — Desktop",      network:"EXOCLICK",     status:"ACTIVE", spend:3200, revenue:5300, impressions:7100000,  clicks:12800, conversions:141 },
  { id:"3", name:"Crypto — Native — AU — Desktop",      network:"TRAFFICSTARS", status:"ACTIVE", spend:3000, revenue:5400, impressions:6500000,  clicks:10300, conversions:125 },
  { id:"4", name:"Dating — Push — FR — Mobile Broad",   network:"TRAFFICSTARS", status:"ACTIVE", spend:2200, revenue:3700, impressions:5200000,  clicks:9100,  conversions:106 },
  { id:"5", name:"Crypto — Push — AU — Desktop",        network:"EXOCLICK",     status:"ACTIVE", spend:2100, revenue:3700, impressions:4600000,  clicks:7900,  conversions:86  },
  { id:"6", name:"Finance — Banner — UK — Desktop",     network:"TRAFFICSTARS", status:"PAUSED", spend:1900, revenue:2900, impressions:4200000,  clicks:7100,  conversions:73  },
  { id:"7", name:"VOD Streaming — Interstitial — CA",   network:"EXOCLICK",     status:"ACTIVE", spend:1800, revenue:2900, impressions:4400000,  clicks:7000,  conversions:74  },
  { id:"8", name:"Nutra — Push — ES — Mobile",          network:"TRAFFICJUNKY", status:"ACTIVE", spend:1600, revenue:2700, impressions:3400000,  clicks:6400,  conversions:68  },
  { id:"9", name:"iGaming — Pop Under — US",            network:"EXOCLICK",     status:"PAUSED", spend:1300, revenue:678,  impressions:17700000, clicks:17700, conversions:8   },
];

const DEMO_TOTALS: DashTotals = {
  totalRevenue: 67500, totalSpend: 27100, totalProfit: 40400,
  roi: 148.8, totalImps: 79300000, totalClicks: 125000, totalConvs: 900, ctr: 0.16, ctrNoPop: 0.22,
};

const DEMO_CHART: ChartPt[] = Array.from({ length: 30 }, (_, i) => {
  const base    = 1200 + Math.sin(i / 4) * 400;
  const spend   = base * 0.4 + (i * 7) % 100;
  const revenue = base + (i * 13) % 200;
  return {
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    spend, revenue, profit: revenue - spend,
  };
});

const DEMO_NETWORKS: NetItem[] = [
  { network:"EXOCLICK",     spend:13300, revenue:21478, profit:8178, roi:50.9, campaigns:5 },
  { network:"TRAFFICSTARS", spend:10200, revenue:15362, profit:5162, roi:50.5, campaigns:3 },
  { network:"TRAFFICJUNKY", spend:3600,  revenue:5490,  profit:1890, roi:52.5, campaigns:1 },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function isoToday()     { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

const PRESETS: DateRange[] = [
  { from: isoToday(),     to: isoToday(),  label: "Today" },
  { from: daysAgo(7),     to: isoToday(),  label: "7D"    },
  { from: daysAgo(30),    to: isoToday(),  label: "30D"   },
  { from: firstOfMonth(), to: isoToday(),  label: "Month" },
  { from: daysAgo(90),    to: isoToday(),  label: "90D"   },
];

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  const abs = Math.abs(n); const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}€${(abs / 1_000).toFixed(1)}k`;
  return `${sign}€${abs.toFixed(2)}`;
}
function fmtBig(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString("en-GB");
}
function fmtROI(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, format = (v: number) => v.toFixed(2) }: {
  value: number; format?: (v: number) => string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const start = prevRef.current; const end = value;
    if (Math.abs(start - end) < 0.001) return;
    const duration = 1100; const startTime = performance.now();
    function step(now: number) {
      const t    = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(start + (end - start) * ease);
      if (t < 1) requestAnimationFrame(step); else prevRef.current = end;
    }
    requestAnimationFrame(step);
  }, [value]);
  return <>{format(displayed)}</>;
}

// ─── 3-Line Trend Chart ───────────────────────────────────────────────────────
function TrendChart({ data, height = 220 }: { data: ChartPt[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(820);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const read = () => { if (el.offsetWidth > 0) setW(el.offsetWidth); };
    read();
    const obs = new ResizeObserver(read); obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [data]);

  if (data.length < 2) return <div ref={wrapRef} style={{ height, width: "100%" }} />;

  const PAD = { t: 10, b: 26, l: 8, r: 8 };
  const IH  = height - PAD.t - PAD.b;
  const IW  = W - PAD.l - PAD.r;

  const allVals = data.flatMap(p => [p.revenue, p.spend, p.profit]);
  const min = Math.min(...allVals); const max = Math.max(...allVals);
  const range = max - min || 1;

  function toX(i: number) { return PAD.l + (i / (data.length - 1)) * IW; }
  function toY(v: number) { return PAD.t + IH - ((v - min) / range) * IH; }
  function buildLine(key: "revenue" | "spend" | "profit") {
    return data.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p[key]).toFixed(1)}`).join(" ");
  }

  const lines = [
    { key: "revenue" as const, color: "rgba(196,181,253,0.95)" },
    { key: "spend"   as const, color: "rgba(252,211,77,0.85)"  },
    { key: "profit"  as const, color: "rgba(110,231,183,0.92)" },
  ];

  const weeks = Math.min(Math.ceil(data.length / 7) + 1, 6);
  const xLabels = Array.from({ length: weeks }, (_, w) => ({
    x: toX(Math.min(w * 7, data.length - 1)),
    label: `W${w + 1}`,
  }));

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
      {[0.25, 0.5, 0.75].map((frac, i) => (
        <div key={i} style={{
          position: "absolute",
          top: PAD.t + IH * (1 - frac),
          left: PAD.l, right: PAD.r, height: 1,
          background: "rgba(255,255,255,0.03)", pointerEvents: "none",
        }} />
      ))}
      <svg width="100%" height={height} style={{ display: "block" }}>
        {lines.map(({ key, color }) => (
          <path
            key={key}
            d={buildLine(key)} fill="none"
            stroke={color} strokeWidth={2.4}
            strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={animated ? undefined : "9999 9999"}
            strokeDashoffset={animated ? 0 : 9999}
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.23,1,0.32,1)" }}
          />
        ))}
        {xLabels.map((p, i) => (
          <text key={i} x={p.x} y={height - 6} textAnchor="middle"
            fontSize={9} fill="rgba(255,255,255,0.18)" fontFamily="inherit">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, tone, format, idx }: {
  label: string; value: number; sub: string; tone: Tone; format: (v: number) => string; idx: number;
}) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay: idx * 0.07, ease: EASE }}
      style={{
        borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))",
        padding: "20px 22px", boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          display: "inline-flex", borderRadius: 9999,
          border: `1px solid ${t.border}`, background: t.bg,
          padding: "3px 12px", fontSize: 10,
          textTransform: "uppercase" as const, letterSpacing: "0.22em",
          color: t.text, marginBottom: 18,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 38, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1,
          color: C(0.92), fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"',
        }}>
          <AnimatedNumber value={value} format={format} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: C(0.38) }}>{sub}</div>
      </div>
      <div style={{
        width: 80, height: 56, borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg viewBox="0 0 100 44" style={{ width: 64, height: 40, opacity: 0.9 }}>
          <path
            d="M 6 20 C 24 18, 24 16, 40 18 S 60 18, 78 10 S 86 24, 94 18"
            fill="none" stroke={t.line} strokeWidth={2.4}
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
    </motion.div>
  );
}

// ─── Net Row ──────────────────────────────────────────────────────────────────
function NetRow({ name, profit, roi, pct, color }: {
  name: string; profit: number; roi: number; pct: number; color: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 15, letterSpacing: "-0.02em", color: C(0.82) }}>{name}</div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C(0.62), fontVariantNumeric: "tabular-nums" }}>{fmtMoney(profit)}</span>
          <span style={{ fontSize: 13, color: "rgba(110,231,183,0.8)" }}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 9999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 9999, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const router         = useRouter();
  const [range,        setRange]        = useState<DateRange>(PRESETS[2]);
  const [loading,      setLoading]      = useState(true);
  const [dashData,     setDashData]     = useState<DashStats | null>(null);
  const [syncData,     setSyncData]     = useState<SyncData | null>(null);
  const [isDemo,       setIsDemo]       = useState(false);
  const [sortKey,      setSortKey]      = useState<SortKey>("revenue");
  const [sortDir,      setSortDir]      = useState<"desc" | "asc">("desc");
  const [activePreset, setActivePreset] = useState("30D");

  const fetchAll = useCallback(async (r: DateRange) => {
    setLoading(true);
    try {
      const qs = `dateFrom=${r.from}&dateTo=${r.to}`;
      const [r1, r2] = await Promise.all([
        fetch(`/api/dashboard/stats?${qs}`),
        fetch(`/api/stats?${qs}`),
      ]);
      if (!r1.ok) throw new Error(`Stats API error: HTTP ${r1.status}`);
      if (!r2.ok) throw new Error(`Sync API error: HTTP ${r2.status}`);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setDashData(d1 as DashStats);
      setSyncData(d2 as SyncData);
      const camps = (d2 as SyncData)?.campaigns ?? [];
      setIsDemo(camps.length === 0);
    } catch (e) {
      console.error("StatisticsPage fetch error:", e);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(range); }, [range, fetchAll]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const campaigns    = isDemo ? DEMO_CAMPAIGNS : (syncData?.campaigns      ?? []);
  const totals       = isDemo ? DEMO_TOTALS    : dashData?.totals;
  const chartData    = isDemo ? DEMO_CHART     : (dashData?.chartData      ?? []);
  const netBreakdown = isDemo ? DEMO_NETWORKS  : (dashData?.networkBreakdown ?? []);

  const revenue = totals?.totalRevenue ?? 0;
  const spend   = totals?.totalSpend   ?? 0;
  const profit  = totals?.totalProfit  ?? (revenue - spend);
  const roi     = totals?.roi          ?? (spend > 0 ? ((revenue - spend) / spend) * 100 : 0);

  const activeCnt = campaigns.filter(c => c.status === "ACTIVE").length;
  const pausedCnt = campaigns.filter(c => c.status === "PAUSED").length;
  const otherCnt  = campaigns.length - activeCnt - pausedCnt;

  const NET_DISPLAY = [
    { key: "EXOCLICK",     label: "ExoClick",     color: "rgba(252,211,77,0.8)"  },
    { key: "TRAFFICSTARS", label: "TrafficStars", color: "rgba(196,181,253,0.8)" },
    { key: "TRAFFICJUNKY", label: "TrafficJunky", color: "rgba(125,211,252,0.8)" },
  ];

  const maxProfit = Math.max(...netBreakdown.map(n => n.profit ?? n.revenue - n.spend), 0.01);
  const netRows = NET_DISPLAY.map(nd => {
    const item      = netBreakdown.find(n => n.network === nd.key);
    const netProfit = item ? (item.profit ?? item.revenue - item.spend) : 0;
    const netRoi    = item ? item.roi : 0;
    return { ...nd, profit: netProfit, roi: netRoi, pct: maxProfit > 0 ? (netProfit / maxProfit) * 100 : 0 };
  }).filter(n => n.profit > 0);

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const va = Number(a[sortKey] ?? 0);
    const vb = Number(b[sortKey] ?? 0);
    return sortDir === "desc" ? vb - va : va - vb;
  });

  const topPerformer = [...campaigns].sort((a, b) => b.revenue - a.revenue)[0];
  const topRoi = topPerformer && topPerformer.spend > 0
    ? ((topPerformer.revenue - topPerformer.spend) / topPerformer.spend) * 100 : 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function exportCSV() {
    const headers = ["Name", "Network", "Status", "Spend", "Revenue", "Profit", "ROI (%)", "Impressions", "Clicks", "Conversions"];
    const rows = sortedCampaigns.map(c => {
      const p = c.revenue - c.spend;
      const r = c.spend > 0 ? ((p / c.spend) * 100).toFixed(1) : "0";
      return [
        `"${c.name.replace(/"/g, '""')}"`,
        NET_LABELS[c.network] ?? c.network, c.status,
        c.spend.toFixed(2), c.revenue.toFixed(2), p.toFixed(2), r,
        String(c.impressions), String(c.clicks), String(c.conversions),
      ].join(",");
    });
    const url = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" }));
    const a   = document.createElement("a");
    a.href = url; a.download = `analytics-${range.from}-${range.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const donutTotal = activeCnt + pausedCnt + otherCnt || 1;
  const activePct  = Math.round((activeCnt / donutTotal) * 100);
  const pausedPct  = Math.round((pausedCnt / donutTotal) * 100);
  const donutBg    = `conic-gradient(rgba(110,231,183,0.8) 0 ${activePct}%,rgba(148,163,184,0.55) ${activePct}% ${activePct + pausedPct}%,rgba(251,191,36,0.65) ${activePct + pausedPct}% 100%)`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "22px 26px 80px", color: C(0.88) }}>
      <div style={{
        maxWidth: 1540, margin: "0 auto",
        borderRadius: 30, border: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg,rgba(11,12,18,0.98),rgba(8,9,14,0.98))",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.02),0 35px 120px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: "28px 32px 26px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "radial-gradient(circle at 22% 0%,rgba(99,102,241,0.08),transparent 34%)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32,
        }}>
          <div>
            {/* Breadcrumb */}
            <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", color: "rgba(255,255,255,0.38)", fontSize: 12, letterSpacing: "0.04em", marginBottom: 14 }}>
              <ChevronLeft size={14} style={{ marginTop: 1 }} />
              Dashboard
            </Link>
            <div style={{
              fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.24em",
              color: "rgba(110,231,183,0.8)", marginBottom: 10,
            }}>
              Analysis layer
            </div>
            <h1 style={{ fontSize: 40, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 0.96, margin: 0 }}>
              Analytics
            </h1>
            <p style={{ marginTop: 14, maxWidth: 640, color: C(0.46), fontSize: 15, lineHeight: 1.7 }}>
              Understand why performance happened across time, networks, geos and campaign segments — more strategic than Dashboard, less event-driven than Transactions.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" as const }}>
            {PRESETS.map(p => (
              <button key={p.label}
                onClick={() => { setRange(p); setActivePreset(p.label); }}
                style={{
                  borderRadius: 16, cursor: "pointer",
                  border: activePreset === p.label ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.10)",
                  background: activePreset === p.label ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  color: activePreset === p.label ? C(0.92) : C(0.7),
                  padding: "9px 16px", fontSize: 13, transition: "all 0.14s",
                }}
              >{p.label}</button>
            ))}
            <button style={{
              borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)", color: C(0.7),
              padding: "9px 16px", fontSize: 13, cursor: "pointer",
            }}>Custom</button>
            <button onClick={exportCSV} disabled={loading} style={{
              borderRadius: 16, border: "1px solid rgba(52,211,153,0.14)",
              background: "rgba(16,185,129,0.08)", color: "rgba(167,243,208,1)",
              padding: "9px 16px", fontSize: 13, cursor: "pointer",
              opacity: loading ? 0.5 : 1,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Download size={12} strokeWidth={1.6} />
              CSV
            </button>
            {loading && (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <RefreshCw size={14} color={C(0.28)} />
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── Analytics empty state ─────────────────────────────────────── */}
          {isDemo && !loading && (
            <EmptyStateCard
              tone="sky"
              badge="Analytics empty"
              title="Not enough data yet to analyze patterns."
              text="Analytics needs spend, clicks, or conversions before trends become meaningful. Connect your ad networks and run campaigns to unlock full performance analysis."
              cta1="Open campaigns"
              cta1Href="/dashboard/campaigns"
              cta2="Connect networks"
              cta2Href="/dashboard/settings"
              preview={
                <div style={{
                  width: "100%", maxWidth: 480,
                  borderRadius: 26,
                  border: "1px solid rgba(56,189,248,0.18)",
                  background: "rgba(14,165,233,0.07)",
                  padding: 20,
                }}>
                  <div style={{
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(0,0,0,0.12)",
                    height: 200, position: "relative", overflow: "hidden",
                    padding: "18px 20px",
                  }}>
                    {/* Ghost bars */}
                    <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", alignItems: "flex-end", gap: 6, height: 110 }}>
                      {[40, 65, 30, 75, 50, 85, 45].map((h, i) => (
                        <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "5px 5px 0 0", background: "rgba(56,189,248,0.08)" }} />
                      ))}
                    </div>
                    {/* Overlay */}
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
                      <div>
                        <div style={{ fontSize: 20, letterSpacing: "-0.04em", fontWeight: 300, color: "rgba(255,255,255,0.88)" }}>
                          Waiting for trend data
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.34)", lineHeight: 1.55, fontWeight: 300 }}>
                          Run campaigns for a bit longer to unlock meaningful performance analysis.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          )}

          {/* ── Real data sections (hidden when no data) ─────────────────── */}
          {!isDemo && (<>

          {/* ── KPI Row ──────────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
            <KPICard idx={0} tone="violet"  label="Revenue" value={revenue} format={fmtMoney}
              sub={`${fmtBig(totals?.totalConvs ?? 900)} approved + pending events`} />
            <KPICard idx={1} tone="amber"   label="Spend"   value={spend}   format={fmtMoney}
              sub="Across selected campaigns" />
            <KPICard idx={2} tone="emerald" label="Profit"  value={profit}  format={fmtMoney}
              sub={`Net profit · ROI ${fmtROI(roi)}`} />
            <KPICard idx={3} tone="sky"     label="ROI"     value={roi}     format={fmtROI}
              sub="Performance across selected scope" />
          </div>

          {/* ── Mid: Trend + Networks/Geos ───────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.18fr 0.82fr", gap: 22 }}>

            {/* Trend chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.28, ease: EASE }}
              style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24) }}>Performance trend</div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>
                    Revenue, spend and profit over selected period
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: C(0.34), flexShrink: 0 }}>
                  {[
                    { label: "Revenue", color: "rgba(196,181,253,1)" },
                    { label: "Spend",   color: "rgba(252,211,77,1)"  },
                    { label: "Profit",  color: "rgba(110,231,183,1)" },
                  ].map(({ label, color }) => (
                    <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />{label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Inner panel */}
              <div style={{
                borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)",
                background: "linear-gradient(180deg,rgba(14,16,23,0.96),rgba(10,11,17,0.96))",
                padding: "20px 18px 14px",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
                  {[
                    { label: "Revenue",     val: fmtMoney(revenue), color: "rgba(196,181,253,1)" },
                    { label: "Spend",       val: fmtMoney(spend),   color: "rgba(252,211,77,1)"  },
                    { label: "Profit",      val: fmtMoney(profit),  color: "rgba(110,231,183,1)" },
                    { label: "Impressions", val: fmtBig(totals?.totalImps ?? 79300000), color: C(0.84) },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24) }}>{label}</div>
                      <div style={{ marginTop: 5, fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{
                  borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)", overflow: "hidden",
                }}>
                  <TrendChart data={chartData} height={220} />
                </div>
              </div>
            </motion.div>

            {/* Right: Networks + Geos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.35, ease: EASE }}
                style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24), marginBottom: 6 }}>By network</div>
                <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", marginBottom: 22 }}>Profit contribution</div>
                {netRows.length > 0
                  ? netRows.map(n => <NetRow key={n.key} name={n.label} profit={n.profit} roi={n.roi} pct={n.pct} color={n.color} />)
                  : <div style={{ color: C(0.28), fontSize: 12 }}>No network data for this period.</div>
                }
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.42, ease: EASE }}
                style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24), marginBottom: 6 }}>Best geos</div>
                <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", marginBottom: 18 }}>Where profitability is strongest</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { geo: "USA",     roi: "+62%", note: "Best on Adult Dating / Push"    },
                    { geo: "Germany", roi: "+44%", note: "Strong on Finance / Native"     },
                    { geo: "Brazil",  roi: "+71%", note: "Best banner profitability"      },
                    { geo: "UK",      roi: "+55%", note: "Stable higher-value conversions" },
                  ].map(({ geo, roi, note }) => (
                    <div key={geo} style={{
                      borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)", padding: "12px 16px",
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
                    }}>
                      <div>
                        <div style={{ fontSize: 15, letterSpacing: "-0.02em", color: C(0.82) }}>{geo}</div>
                        <div style={{ marginTop: 3, fontSize: 11, color: C(0.32) }}>{note}</div>
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(110,231,183,0.82)", flexShrink: 0 }}>{roi}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── Bottom: Campaign table + Sidebar ─────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22 }}>

            {/* Campaign table */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.49, ease: EASE }}
              style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24), marginBottom: 6 }}>Campaign table</div>
                  <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>Campaign-level performance for deeper analysis</div>
                </div>
                <div style={{
                  borderRadius: 9999, border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)", padding: "4px 12px",
                  fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.55), flexShrink: 0,
                }}>
                  {campaigns.length} total
                </div>
              </div>

              <div style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                {/* Table header */}
                {(() => {
                  const cols: { key: SortKey | null; label: string; flex: number }[] = [
                    { key: null,          label: "Campaign",  flex: 1.8 },
                    { key: "spend",       label: "Spend",     flex: 0.7 },
                    { key: "revenue",     label: "Revenue",   flex: 0.7 },
                    { key: null,          label: "Profit",    flex: 0.9 },
                    { key: "impressions", label: "Impr.",     flex: 0.65 },
                    { key: "clicks",      label: "Clicks",    flex: 0.55 },
                    { key: "conversions", label: "Conv.",     flex: 0.45 },
                    { key: null,          label: "Network",   flex: 0.8 },
                  ];
                  return (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: cols.map(c => `${c.flex}fr`).join(" "),
                      gap: 12, padding: "13px 20px",
                      background: "rgba(255,255,255,0.03)",
                    }}>
                      {cols.map(col => (
                        <div key={col.label}
                          onClick={() => col.key && toggleSort(col.key)}
                          style={{
                            fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.28),
                            cursor: col.key ? "pointer" : "default",
                            userSelect: "none" as const,
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                          {col.label}
                          {col.key && sortKey === col.key && (
                            <span style={{ fontSize: 10, color: C(0.4) }}>{sortDir === "desc" ? "↓" : "↑"}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Data rows */}
                {sortedCampaigns.map((c, i) => {
                  const cProfit   = c.revenue - c.spend;
                  const cRoi      = c.spend > 0 ? ((cProfit / c.spend) * 100) : 0;
                  const badgeMeta = NET_BADGE[c.network] ?? NET_BADGE["TRAFFICJUNKY"];
                  return (
                    <div
                      key={c.id || i}
                      onClick={() => c.id && router.push(`/dashboard/campaigns/${c.id}`)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.8fr 0.7fr 0.7fr 0.9fr 0.65fr 0.55fr 0.45fr 0.8fr",
                        gap: 12, padding: "13px 20px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        background: "linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0))",
                        alignItems: "center", fontSize: 13,
                        cursor: c.id ? "pointer" : "default",
                        transition: "background 0.14s",
                      }}
                      onMouseEnter={e => { if (c.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.035)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0))"; }}
                    >
                      <div style={{ color: C(0.88), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontWeight: 400 }}>{c.name}</div>
                      <div style={{ color: C(0.48), fontVariantNumeric: "tabular-nums" }}>{fmtMoney(c.spend)}</div>
                      <div style={{ color: C(0.60), fontVariantNumeric: "tabular-nums" }}>{fmtMoney(c.revenue)}</div>
                      <div>
                        <div style={{ color: cProfit >= 0 ? "rgba(110,231,183,0.88)" : "rgba(251,113,133,0.88)", fontVariantNumeric: "tabular-nums" }}>
                          {fmtMoney(cProfit)}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 11, color: cRoi >= 0 ? "rgba(110,231,183,0.6)" : "rgba(251,113,133,0.6)" }}>
                          ROI {cRoi >= 0 ? "+" : ""}{cRoi.toFixed(0)}%
                        </div>
                      </div>
                      <div style={{ color: C(0.36), fontVariantNumeric: "tabular-nums" }}>{fmtBig(c.impressions)}</div>
                      <div style={{ color: C(0.36), fontVariantNumeric: "tabular-nums" }}>{fmtBig(c.clicks)}</div>
                      <div style={{ color: C(0.36), fontVariantNumeric: "tabular-nums" }}>{c.conversions}</div>
                      <div>
                        <span style={{
                          borderRadius: 9999,
                          border: `1px solid ${badgeMeta.border}`,
                          background: badgeMeta.bg, color: badgeMeta.text,
                          padding: "3px 10px", fontSize: 10,
                          textTransform: "uppercase" as const, letterSpacing: "0.18em",
                          whiteSpace: "nowrap" as const,
                        }}>
                          {NET_LABELS[c.network] ?? c.network}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Right sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

              {/* Distribution donut */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.56, ease: EASE }}
                style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24), marginBottom: 6 }}>Distribution</div>
                <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", marginBottom: 20 }}>Campaign state mix</div>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{
                    width: 120, height: 120, borderRadius: "50%",
                    background: donutBg, padding: 14, flexShrink: 0,
                  }}>
                    <div style={{
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: "#0e1017", border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1 }}>{campaigns.length}</div>
                      <div style={{ marginTop: 3, fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.28) }}>Total</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                    {[
                      { label: "Actives", count: activeCnt, color: "rgba(110,231,183,1)"     },
                      { label: "Paused",  count: pausedCnt, color: "rgba(148,163,184,0.7)"   },
                      { label: "Others",  count: otherCnt,  color: "rgba(251,191,36,0.7)"    },
                    ].map(({ label, count, color }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ color: C(0.42) }}>{label}</span>
                        <span style={{ color: C(0.80), marginLeft: "auto" }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Top performer */}
              {topPerformer && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.63, ease: EASE }}
                  style={{
                    borderRadius: 28,
                    border: "1px solid rgba(52,211,153,0.16)",
                    background: "rgba(16,185,129,0.08)",
                    padding: "22px 24px",
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: "rgba(167,243,208,0.8)", marginBottom: 10 }}>
                    Top performer
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 200, letterSpacing: "-0.04em", color: C(0.88), lineHeight: 1.4 }}>
                    {topPerformer.name}
                  </div>
                  <div style={{ marginTop: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(topPerformer.revenue)}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.34) }}>Revenue</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(110,231,183,1)" }}>
                        {topRoi >= 0 ? "+" : ""}{topRoi.toFixed(1)}%
                      </div>
                      <div style={{ marginTop: 3, fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.34) }}>ROI</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Why this page matters */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.70, ease: EASE }}
                style={{ borderRadius: 28, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "22px 24px" }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.24), marginBottom: 14 }}>
                  What Analytics should answer
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, lineHeight: 1.7, color: C(0.44) }}>
                  {[
                    "Which network contributes the most profit over time",
                    "Which geos and formats stay profitable",
                    "Which campaigns are stable winners vs volatile spikes",
                    "Where budget and revenue diverge too much",
                  ].map((item, i) => (
                    <div key={i}>· {item}</div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
