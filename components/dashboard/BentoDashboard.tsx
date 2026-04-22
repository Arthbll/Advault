"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, RefreshCw, TrendingUp, TrendingDown, Activity, Globe2, Zap } from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import ProfitChart, { ChartPoint } from "./ProfitChart";
import CampaignsPnL, { CampaignRow } from "./CampaignsPnL";
import WorldMap from "./WorldMap";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

// ─── Geo types ────────────────────────────────────────────────────────────────

interface GeoDot {
  label: string; countryCode: string;
  x: number; y: number;
  impressions: string; clicks: string; spent: string;
  size: number; delay: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Totals {
  totalSpend: number; totalRevenue: number; totalProfit: number; roi: number;
  totalImps: number; totalClicks: number; totalConvs: number; ctr: number;
  ctrNoPop?: number;
  clickImps?: number; clickClicks?: number; clickCtr?: number;
  popImps?: number; popConvs?: number; popConvRate?: number;
}

interface NetworkRow {
  network: string; spend: number; revenue: number;
  profit: number; roi: number; campaigns: number; impressions?: number;
}

interface DashboardData {
  totals: Totals;
  chartData: ChartPoint[];
  networkBreakdown: NetworkRow[];
  activeCampaigns: number;
}

interface Props extends DashboardData {
  profitLabel: string; roiLabel: string; spendLabel: string;
  convLabel: string; spendSub: string; convSub: string;
  alerts?: unknown[];
  topCampaigns?: CampaignRow[];
  trend?: number | null;
  needsSync?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NET_META: Record<string, { label: string; color: string; rgb: string }> = {
  EXOCLICK:     { label: "ExoClick",     color: "#f59e0b", rgb: "245,158,11"  },
  TRAFFICSTARS: { label: "TrafficStars", color: "#8b5cf6", rgb: "139,92,246"  },
  TRAFFICJUNKY: { label: "TrafficJunky", color: "#0ea5e9", rgb: "14,165,233"  },
  PROPELLERADS: { label: "PropellerAds", color: "#f97316", rgb: "249,115,22"  },
  ADSTERRA:     { label: "Adsterra",     color: "#06b6d4", rgb: "6,182,212"   },
  VOLUUM:       { label: "Voluum",       color: "#10b981", rgb: "16,185,129"  },
  BEMOB:        { label: "Bemob",        color: "#f43f5e", rgb: "244,63,94"   },
};

const CARD: React.CSSProperties = {
  background: "#17171e",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 24,
  overflow: "hidden",
};

// ─── Typography helpers ───────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "#3f3f46",
};

function BigNum({ value, color = "rgba(255,255,255,0.92)", size = 38 }: {
  value: string | number; color?: string; size?: number;
}) {
  return (
    <span style={{
      fontSize: size, fontWeight: 200,
      letterSpacing: "-0.05em", lineHeight: 1,
      color, display: "block",
      fontVariantNumeric: "tabular-nums",
      fontFeatureSettings: '"tnum"',
    }}>
      {value}
    </span>
  );
}

function zeroFmt(n: number, fmt: (n: number) => string): string {
  return n === 0 ? "—" : fmt(n);
}
function zeroColor(n: number, activeColor: string): string {
  return n === 0 ? "rgba(255,255,255,0.18)" : activeColor;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtEuro(n: number) {
  if (n === 0) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
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

function isoToday()  { return new Date().toISOString().slice(0, 10); }
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
  { from: isoToday(),     to: isoToday(),  label: "Today" },
  { from: daysAgo(7),     to: isoToday(),  label: "7D"    },
  { from: daysAgo(30),    to: isoToday(),  label: "30D"   },
  { from: firstOfMonth(), to: isoToday(),  label: "Month" },
];

// ─── Date Range Selector ──────────────────────────────────────────────────────

function DateSelector({ range, onChange, loading }: {
  range: DateRange; onChange: (r: DateRange) => void; loading: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo,   setCustomTo]   = useState(range.to);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 3 }}>
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => { onChange(p); setCustomOpen(false); }}
          style={{
            padding: "7px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer",
            fontWeight: range.label === p.label ? 600 : 400,
            background: range.label === p.label ? "rgba(255,255,255,0.92)" : "transparent",
            color:      range.label === p.label ? "#0d0d10"                : "rgba(113,113,122,0.9)",
            border:     range.label === p.label ? "none"                   : "1px solid rgba(255,255,255,0.07)",
            transition: "all 0.15s",
          }}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => setCustomOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer",
          fontWeight: range.label === "Custom" ? 600 : 400,
          background: range.label === "Custom" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.03)",
          color:      range.label === "Custom" ? "#0d0d10"                : "rgba(113,113,122,0.9)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <Calendar size={11} />
        {range.label === "Custom" ? `${range.from} → ${range.to}` : "Custom"}
      </button>
      {loading && (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={13} color="#52525b" />
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
              background: "#1c1c26", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 16, padding: "16px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.8)", minWidth: 260,
            }}
          >
            <p style={{ ...LABEL, marginBottom: 10 }}>Custom range</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="date" value={customFrom} max={customTo}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", colorScheme: "dark", outline: "none" }}
              />
              <span style={{ color: "#3f3f46", fontSize: 12 }}>→</span>
              <input type="date" value={customTo} min={customFrom} max={isoToday()}
                onChange={e => setCustomTo(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", colorScheme: "dark", outline: "none" }}
              />
            </div>
            <button
              onClick={() => { onChange({ from: customFrom, to: customTo, label: "Custom" }); setCustomOpen(false); }}
              style={{ width: "100%", padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.22)", cursor: "pointer" }}
            >
              Apply
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
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: i * 0.07 },
  };
}

// ─── Tone helpers ─────────────────────────────────────────────────────────────

type Tone = "rose" | "amber" | "emerald" | "violet" | "neutral";

function toneCard(t: Tone): React.CSSProperties {
  if (t === "rose")    return { background: "rgba(239,68,68,0.06)",    border: "1px solid rgba(248,113,113,0.14)", borderRadius: 18 };
  if (t === "amber")   return { background: "rgba(245,158,11,0.06)",   border: "1px solid rgba(251,191,36,0.14)",  borderRadius: 18 };
  if (t === "emerald") return { background: "rgba(16,185,129,0.06)",   border: "1px solid rgba(74,222,128,0.14)",  borderRadius: 18 };
  if (t === "violet")  return { background: "rgba(139,92,246,0.06)",   border: "1px solid rgba(167,139,250,0.14)", borderRadius: 18 };
  return { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18 };
}
function toneBadge(t: Tone): React.CSSProperties {
  if (t === "rose")    return { background: "rgba(239,68,68,0.10)",    border: "1px solid rgba(248,113,113,0.18)", color: "#fca5a5",  borderRadius: 99, padding: "3px 11px", fontSize: 9,  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", display: "inline-block" };
  if (t === "amber")   return { background: "rgba(245,158,11,0.10)",   border: "1px solid rgba(251,191,36,0.18)",  color: "#fcd34d",  borderRadius: 99, padding: "3px 11px", fontSize: 9,  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", display: "inline-block" };
  if (t === "emerald") return { background: "rgba(16,185,129,0.10)",   border: "1px solid rgba(74,222,128,0.18)",  color: "#86efac",  borderRadius: 99, padding: "3px 11px", fontSize: 9,  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", display: "inline-block" };
  if (t === "violet")  return { background: "rgba(139,92,246,0.10)",   border: "1px solid rgba(167,139,250,0.18)", color: "#c4b5fd",  borderRadius: 99, padding: "3px 11px", fontSize: 9,  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", display: "inline-block" };
  return { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)", borderRadius: 99, padding: "3px 11px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", display: "inline-block" };
}
function toneText(t: Tone): string {
  if (t === "rose")    return "#fca5a5";
  if (t === "amber")   return "#fcd34d";
  if (t === "emerald") return "#86efac";
  if (t === "violet")  return "#c4b5fd";
  return "rgba(255,255,255,0.70)";
}

// ─── Engine event type ────────────────────────────────────────────────────────

interface EngineEvent {
  id:        string;
  state:     string;
  tone:      Tone;
  campaign:  string;
  network:   string;
  detail:    string;
  time:      string;
  createdAt: string;
}

// ─── Placeholder affiché tant que le fetch initial n'est pas revenu ──────────
// Ces données ne sont jamais visibles par les vrais clients — elles servent
// uniquement de skeleton avant que l'API réponde (< 500ms en prod).

const PLACEHOLDER_FEED: EngineEvent[] = [
  { id: "ph-1", state: "KILL",  tone: "rose",    campaign: "—",  network: "—", detail: "Loading…", time: "—", createdAt: "" },
  { id: "ph-2", state: "WATCH", tone: "amber",   campaign: "—",  network: "—", detail: "Loading…", time: "—", createdAt: "" },
  { id: "ph-3", state: "SCALE", tone: "emerald", campaign: "—",  network: "—", detail: "Loading…", time: "—", createdAt: "" },
];

// ─── Client-side time helpers ─────────────────────────────────────────────────

function timeAgoClient(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s <    60) return `${s}s ago`;
  if (s <  3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return               `${Math.round(s / 86400)}d ago`;
}

// ─── Live stream helpers ──────────────────────────────────────────────────────

/** Cleans up campaign names before display — strips UUIDs, blanks, placeholder text */
function cleanCampaignName(raw: string): string {
  if (!raw || !raw.trim()) return "Campaign";
  const s = raw.trim();
  // UUID-like? Replace with a readable short ref
  if (/^[0-9a-f-]{36}$/i.test(s)) return "Campaign";
  // Known placeholder strings from old code
  if (s === "Unknown campaign" || s === "—" || s === "-") return "Campaign";
  return s;
}

/** Returns true if the network value is a real, displayable network name */
function isValidNetwork(n: string): boolean {
  return !!n && n !== "—" && n !== "-" && n.length > 0;
}

// ─── Campaign state derivation ────────────────────────────────────────────────

function campaignTone(roi: number, status: string): Tone {
  const st = (status ?? "").toLowerCase();
  if (st.includes("kill") || st.includes("paused") || roi < -25)  return "rose";
  if (st.includes("watch") || (roi < 0 && roi >= -25))             return "amber";
  if (st.includes("scal") || roi >= 25)                            return "emerald";
  return "neutral";
}

// ─── Scan loop progress indicator ────────────────────────────────────────────
// Animates a 14-second cycle to signal the engine is actively running

function ScanLoopIndicator({ intervalMs }: { intervalMs: number }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const frame = () => {
      const elapsed = (Date.now() - start) % intervalMs;
      setTick(elapsed / intervalMs);
      raf.current = requestAnimationFrame(frame);
    };
    const raf = { current: requestAnimationFrame(frame) };
    return () => cancelAnimationFrame(raf.current);
  }, [intervalMs]);

  const pct = tick * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3f3f46" }}>
        Scan cycle
      </span>
      <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${pct}%`,
          background: "linear-gradient(90deg, rgba(37,99,235,0.7), rgba(139,92,246,0.8))",
          transition: "width 0.1s linear",
        }} />
      </div>
      <span style={{ fontSize: 9, color: "#3f3f46", fontVariantNumeric: "tabular-nums" }}>
        {((1 - tick) * intervalMs / 1000).toFixed(1)}s
      </span>
    </div>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const TABLE_FILTERS = ["All", "Needs action", "Watching", "Scaling"] as const;
type TableFilter = typeof TABLE_FILTERS[number];

// ─── Campaign summary card (best / worst) ─────────────────────────────────────

function CampaignSummaryRow({ camp, variant }: { camp: CampaignRow; variant: "best" | "worst" }) {
  const meta   = NET_META[camp.network] ?? { label: camp.network, color: "#52525b", rgb: "82,82,91" };
  const Icon   = variant === "best" ? TrendingUp : TrendingDown;
  const clr    = variant === "best" ? "#4ade80" : "#f87171";
  const bg     = variant === "best" ? "rgba(74,222,128,0.05)"   : "rgba(248,113,113,0.05)";
  const border = variant === "best" ? "1px solid rgba(74,222,128,0.12)" : "1px solid rgba(248,113,113,0.12)";

  return (
    <div style={{ padding: "10px 14px", background: bg, border, borderRadius: 14, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={11} color={clr} strokeWidth={2.5} />
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: clr }}>
            {variant === "best" ? "Best" : "Worst"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color }} />
          <span style={{ fontSize: 10, color: "#52525b" }}>{meta.label}</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", fontWeight: 400, margin: 0, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {camp.name}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 200, letterSpacing: "-0.04em", color: clr, fontVariantNumeric: "tabular-nums" }}>
          {camp.profit >= 0 ? "+" : ""}{fmtEuro(camp.profit)}
        </span>
        <span style={{ fontSize: 11, color: "#52525b" }}>
          {camp.roi >= 0 ? "+" : ""}{camp.roi.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Engine state cell ────────────────────────────────────────────────────────
// Compact, system-native — not a hero stat, a live state indicator

function EngineStateCell({ label, value, color, accentRgb, sub }: {
  label: string; value: number; color: string; accentRgb: string; sub: string;
}) {
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", gap: 8,
      padding: "14px 16px 12px",
      background: `rgba(${accentRgb},0.05)`,
      border: `1px solid rgba(${accentRgb},0.13)`,
      borderRadius: 14,
    }}>
      {/* Left accent bar */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 3, background: `rgba(${accentRgb},0.6)`,
        borderRadius: "14px 0 0 14px",
      }} />

      <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#3f3f46" }}>
        {label}
      </span>
      <span style={{
        fontSize: 32, fontWeight: 200, letterSpacing: "-0.05em", lineHeight: 1,
        color, fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: "#3f3f46", letterSpacing: "0.01em" }}>{sub}</span>
    </div>
  );
}

// ─── Impression bar ───────────────────────────────────────────────────────────

function ImpBar({ label, value, share, color }: { label: string; value: string; share: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", fontWeight: 400 }}>{label}</span>
        <span style={{ fontSize: 12, color: "#52525b", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${share}%` }}
          transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
          style={{ height: "100%", borderRadius: 99, background: color, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BentoDashboard(props: Props) {
  const [dateRange,     setDateRange]     = useState<DateRange>({ from: daysAgo(30), to: isoToday(), label: "30D" });
  const [data,          setData]          = useState<DashboardData>({
    totals:           props.totals,
    chartData:        props.chartData,
    networkBreakdown: props.networkBreakdown,
    activeCampaigns:  props.activeCampaigns,
  });
  const [loading,       setLoading]       = useState(false);
  const [geoDots,       setGeoDots]       = useState<GeoDot[]>([]);
  const [tableFilter,   setTableFilter]   = useState<TableFilter>("All");
  const [activeNet,     setActiveNet]     = useState<string | undefined>(undefined);
  const isMobile = useIsMobile();

  // ── Engine live feed ──────────────────────────────────────────────────────
  const [engineEvents,  setEngineEvents]  = useState<EngineEvent[]>(PLACEHOLDER_FEED);
  const [engineLoading, setEngineLoading] = useState(true);
  const [engineCounts,  setEngineCounts]  = useState({ killed: 0, watch: 0, scaled: 0, today: 0, rulesCount: 0, protectedAmount: 0, lastEventAt: null as string | null });
  const [showAllEvents, setShowAllEvents] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof createSupabaseClient> | null>(null);

  const fetchEngineActions = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/actions");
      if (!res.ok) return;
      const json = await res.json() as {
        events:          EngineEvent[];
        todayCount:      number;
        killedToday:     number;
        watchToday:      number;
        scaledToday:     number;
        rulesCount:      number;
        protectedAmount: number;
        lastEventAt:     string | null;
      };
      setEngineEvents(json.events.length > 0 ? json.events : []);
      setEngineCounts({
        killed:          json.killedToday,
        watch:           json.watchToday,
        scaled:          json.scaledToday,
        today:           json.todayCount,
        rulesCount:      json.rulesCount      ?? 0,
        protectedAmount: json.protectedAmount ?? 0,
        lastEventAt:     json.lastEventAt     ?? null,
      });
    } catch {
      /* Réseau indisponible — on garde le dernier état connu */
    } finally {
      setEngineLoading(false);
    }
  }, []);

  // ── Supabase Realtime : écoute les INSERT sur Log ────────────────────────
  // Dès qu'un nouveau log moteur est inséré, on refresh le feed sans polling.
  // ⚠️  Prérequis Supabase : activer Realtime sur la table "Log" dans
  //     Database → Replication → Source tables.
  useEffect(() => {
    // Chargement initial
    void fetchEngineActions();

    // Connexion Realtime
    const supabase = createSupabaseClient();
    realtimeRef.current = supabase;

    const channel = supabase
      .channel("engine-log-stream")
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event:  "INSERT",
          schema: "public",
          table:  "Log",
        },
        (payload: { new: { type?: string } }) => {
          const engineTypes = [
            "KILL_SWITCH_TRIGGERED",
            "DECISION_KILL",
            "DECISION_WATCH",
            "DECISION_SCALE",
          ];
          if (payload.new?.type && engineTypes.includes(payload.new.type)) {
            // Re-fetch pour avoir le format complet + les temps relatifs
            void fetchEngineActions();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchEngineActions]);

  // ── Geo fetch ─────────────────────────────────────────────────────────────
  const fetchGeo = useCallback(async (range: DateRange, network?: string) => {
    try {
      const net = network ?? "ALL";
      const res = await fetch(`/api/dashboard/geo?dateFrom=${range.from}&dateTo=${range.to}&network=${net}`);
      if (!res.ok) return;
      const json = await res.json();
      setGeoDots((json.dots ?? []).map((d: GeoDot, i: number) => ({
        ...d, delay: `${(i * 0.35).toFixed(1)}s`,
      })));
    } catch { /* silently ignore */ }
  }, []);

  // ── Stats fetch ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const [statsRes] = await Promise.all([
        fetch(`/api/dashboard/stats?dateFrom=${range.from}&dateTo=${range.to}`),
        fetchGeo(range, activeNet),
      ]);
      if (statsRes.ok) setData(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [fetchGeo, activeNet]);

  // Fetch geo on mount and whenever the network filter changes
  useEffect(() => { fetchGeo(dateRange, activeNet); }, [activeNet]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDateChange(range: DateRange) {
    setDateRange(range);
    fetchData(range);
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const { totals, chartData, networkBreakdown, activeCampaigns } = data;
  const profitPos = totals.totalProfit >= 0;

  // Engine summary counts — driven by live API data
  const killed   = engineCounts.killed;
  const watching = engineCounts.watch;
  const scaling  = engineCounts.scaled;

  // Campaign table data
  const rawCampaigns: CampaignRow[] = props.topCampaigns?.length
    ? props.topCampaigns
    : networkBreakdown.map((nb, i) => ({
        id:      String(i),
        name:    NET_META[nb.network]?.label ?? nb.network,
        network: nb.network,
        status:  "",
        spend:   nb.spend,
        revenue: nb.revenue,
        profit:  nb.profit,
        roi:     nb.roi,
      }));

  const filteredCampaigns = rawCampaigns.filter(c => {
    const t = campaignTone(c.roi, c.status);
    if (tableFilter === "Needs action") return t === "rose";
    if (tableFilter === "Watching")     return t === "amber";
    if (tableFilter === "Scaling")      return t === "emerald";
    return true;
  });

  // Best / worst campaigns
  const sortedByProfit = [...rawCampaigns].sort((a, b) => b.profit - a.profit);
  const bestCampaign   = sortedByProfit[0] ?? null;
  const worstCampaign  = sortedByProfit[sortedByProfit.length - 1] ?? null;

  // Filter counts
  const tabCounts: Record<TableFilter, number> = {
    "All":          rawCampaigns.length,
    "Needs action": rawCampaigns.filter(c => campaignTone(c.roi, c.status) === "rose").length,
    "Watching":     rawCampaigns.filter(c => campaignTone(c.roi, c.status) === "amber").length,
    "Scaling":      rawCampaigns.filter(c => campaignTone(c.roi, c.status) === "emerald").length,
  };

  // Top connections (top 3 networks by profit)
  const topConnections = [...networkBreakdown]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  // Impression split (format-based where available, network-based fallback)
  const popImps   = totals.popImps   ?? 0;
  const clickImps = totals.clickImps ?? 0;
  const otherImps = Math.max(0, totals.totalImps - popImps - clickImps);
  // Filter out zero-value format segments but always keep "Other" if there's impression data
  const impSplitBase = [
    { label: "Popunder", value: popImps,          color: "#fbbf24" },
    { label: "Push",     value: clickImps * 0.55, color: "#8b5cf6" },
    { label: "Display",  value: clickImps * 0.45, color: "#0ea5e9" },
  ].filter(s => s.value > 0);

  // "Other" is always shown when there's impression data (catches unclassified traffic)
  const otherEntry = { label: "Other", value: Math.max(otherImps, 0), color: "rgba(255,255,255,0.28)" };
  const impSplit = totals.totalImps > 0
    ? [...impSplitBase, otherEntry]
    : impSplitBase;

  // If no format data, fall back to network-based breakdown
  const impSplitFinal = impSplit.length > 0
    ? impSplit
    : networkBreakdown.map(nb => ({
        label: NET_META[nb.network]?.label ?? nb.network,
        value: nb.impressions ?? 0,
        color: NET_META[nb.network]?.color ?? "#52525b",
      }));

  const impMax = Math.max(...impSplitFinal.map(s => s.value), 1);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: isMobile ? "14px 12px 80px" : "22px 26px 72px",
      display: "flex", flexDirection: "column", gap: 14,
      background: [
        "radial-gradient(ellipse at 15% 0%, rgba(37,99,235,0.09) 0%, transparent 40%)",
        "radial-gradient(ellipse at 85% 4%, rgba(139,92,246,0.07) 0%, transparent 30%)",
        "radial-gradient(ellipse at 50% 95%, rgba(248,113,113,0.04) 0%, transparent 30%)",
      ].join(", "),
    }}>

      {/* ── Revenue signal warning ─────────────────────────────────────────── */}
      {totals.totalRevenue === 0 && totals.totalSpend > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 18px",
            borderRadius: 14,
            border: "1px solid rgba(251,191,36,0.20)",
            background: "rgba(245,158,11,0.05)",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            border: "1px solid rgba(251,191,36,0.22)",
            background: "rgba(245,158,11,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>
            ⚠
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(253,230,138,0.90)", marginBottom: 2 }}>
              No revenue signal detected
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.5 }}>
              Your spend is tracked but no revenue has been received. The Decision Engine is running in budget-protection mode only.{" "}
              <a href="/dashboard/settings?tab=postbacks" style={{ color: "rgba(14,165,233,0.80)", textDecoration: "none", fontWeight: 600 }}>
                Set up your postback →
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — engine-first, no date picker
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div {...s(0)} style={{ display: "flex", alignItems: isMobile ? "flex-start" : "flex-end", flexWrap: "wrap", gap: isMobile ? 10 : 0, justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <p style={LABEL}>
            {activeCampaigns > 0 ? `${activeCampaigns} campaign${activeCampaigns > 1 ? "s" : ""} active` : "No active campaigns"}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 200, color: "rgba(255,255,255,0.92)", margin: "5px 0 0", letterSpacing: "-0.05em" }}>
            Performance
          </h1>
        </div>

        {/* Engine live pill — product-facing, not decorative */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(16,185,129,0.07)", border: "1px solid rgba(74,222,128,0.16)",
          borderRadius: 99, padding: "7px 16px",
        }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#86efac" }}>
            Engine live · 14s scan loop
          </span>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — DECISION ENGINE (7fr) + ENGINE LIVE STREAM (5fr)
      ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "7fr 5fr", gap: 14 }}>

        {/* ── Decision Engine — system module, not marketing ────────── */}
        <motion.div {...s(1)} style={{
          ...CARD, padding: "24px 26px",
          background: [
            "radial-gradient(circle at 80% 15%, rgba(37,99,235,0.10), transparent 28%)",
            "radial-gradient(circle at 10% 80%, rgba(139,92,246,0.07), transparent 24%)",
            "#17171e",
          ].join(", "),
          position: "relative", overflow: "hidden",
          borderRadius: 28,
          display: "flex", flexDirection: "column", gap: 18,
        }}>

          {/* ── Top row: identity + scan loop indicator ────────────── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              {/* System badge — compact, not decorative */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginBottom: 10,
              }}>
                <Zap size={10} color="#52525b" strokeWidth={2} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#52525b" }}>
                  Decision Engine
                </span>
              </div>

              {/* Operational status line */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <motion.div
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", letterSpacing: "0.01em" }}>
                  Running · 14s scan
                  {engineCounts.rulesCount > 0 && ` · ${engineCounts.rulesCount} rules active`}
                </span>
              </div>
            </div>

            {/* Scan cycle progress bar */}
            <ScanLoopIndicator intervalMs={14000} />
          </div>

          {/* ── Divider ────────────────────────────────────────────── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

          {/* ── State row: Kill / Watch / Scale ───────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8 }}>
            <EngineStateCell
              label="Killed"
              value={killed}
              color="#f87171"
              accentRgb="248,113,113"
              sub={killed === 1 ? "1 campaign stopped" : `${killed} campaigns stopped`}
            />
            <EngineStateCell
              label="Watching"
              value={watching}
              color="#fbbf24"
              accentRgb="251,191,36"
              sub={watching === 1 ? "review zone" : "in review zone"}
            />
            <EngineStateCell
              label="Scaling"
              value={scaling}
              color="#4ade80"
              accentRgb="74,222,128"
              sub={scaling === 1 ? "bid increased" : "bids increased"}
            />
          </div>

          {/* ── Operational metrics bar ────────────────────────────── */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 8 : 0 }}>
              {[
                { label: "Protected", value: engineCounts.protectedAmount > 0 ? fmtEuro(engineCounts.protectedAmount) : "—" },
                { label: "Scanned",   value: activeCampaigns > 0 ? `${activeCampaigns} campaigns` : "—" },
                { label: "Rules",     value: engineCounts.rulesCount > 0 ? `${engineCounts.rulesCount} active` : "—" },
                { label: "Last scan", value: engineCounts.lastEventAt ? timeAgoClient(engineCounts.lastEventAt) : "—" },
              ].map(({ label, value }, i) => (
                <div key={label} style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  paddingLeft: i > 0 ? 14 : 0,
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#3f3f46" }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.60)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Engine status line ────────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 12px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 10, color: "#3f3f46", letterSpacing: "0.01em" }}>
                {engineCounts.today > 0
                  ? <>{engineCounts.today} decision{engineCounts.today > 1 ? "s" : ""} today</>
                  : "No decisions yet today"
                }
              </span>
              <span style={{ fontSize: 10, color: "#27272a", letterSpacing: "0.01em" }}>
                14s scan interval
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Engine live stream ────────────────────────────────────── */}
        <motion.div {...s(2)} style={{
          ...CARD,
          background: [
            "radial-gradient(circle at 14% 10%, rgba(37,99,235,0.07), transparent 30%)",
            "#17171e",
          ].join(", "),
          display: "flex", flexDirection: "column",
          borderRadius: 28,
        }}>
          {/* Header */}
          <div style={{
            padding: "13px 18px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={LABEL}>Event stream</span>
              {engineCounts.today > 0 && (
                <span style={{ fontSize: 9, color: "#3f3f46", fontVariantNumeric: "tabular-nums" }}>
                  {engineCounts.today} event{engineCounts.today > 1 ? "s" : ""} today
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80" }}
              />
              <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Live
              </span>
            </div>
          </div>

          {/* Event cards — left accent bar signals state, card is the unit */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "8px 12px 8px", gap: 5 }}>
            {engineLoading && engineEvents === PLACEHOLDER_FEED && engineEvents.map((ev, i) => (
              <div key={ev.id} style={{
                height: 62, borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                animation: `pulse 1.6s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
            {!engineLoading && engineEvents.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                padding: "24px 0",
              }}>
                <Activity size={18} color="#2d2d35" strokeWidth={1.5} />
                <span style={{ fontSize: 11, color: "#3f3f46", letterSpacing: "0.03em" }}>Waiting for decisions</span>
                <span style={{ fontSize: 10, color: "#27272a", textAlign: "center", maxWidth: 150, lineHeight: 1.6 }}>
                  The engine is running. Decisions will appear here as campaigns are evaluated.
                </span>
              </div>
            )}
            {!engineLoading && engineEvents.length > 0 && engineEvents.slice(0, showAllEvents ? 30 : 5).map((ev, i) => {
              const netKey = ev.network.toUpperCase().replace(/\s/g, "");
              const netColor = NET_META[netKey]?.color ?? "#52525b";
              const accentColor = toneText(ev.tone);
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 + i * 0.07, duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    position: "relative", overflow: "hidden",
                    display: "flex", gap: 0,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                  }}
                >
                  {/* Left accent bar — the primary state signal */}
                  <div style={{
                    width: 3, flexShrink: 0,
                    background: accentColor,
                    opacity: 0.55,
                    borderRadius: "12px 0 0 12px",
                  }} />

                  <div style={{ flex: 1, padding: "9px 11px" }}>
                    {/* Top row: badge + network + time */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <span style={toneBadge(ev.tone)}>{ev.state}</span>
                      {isValidNetwork(ev.network) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ width: 4, height: 4, borderRadius: "50%", background: netColor }} />
                          <span style={{ fontSize: 9, color: "#52525b" }}>{ev.network}</span>
                        </div>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#3f3f46", letterSpacing: "0.02em" }}>
                        {ev.time}
                      </span>
                    </div>

                    {/* Campaign name — sanitized, never shows raw IDs or placeholder strings */}
                    <p style={{
                      fontSize: 12, fontWeight: 400, letterSpacing: "-0.02em",
                      color: "rgba(255,255,255,0.82)", margin: "0 0 4px", lineHeight: 1.3,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {cleanCampaignName(ev.campaign)}
                    </p>

                    {/* Detail — SCALE gets a dedicated injection display */}
                    {ev.tone === "emerald" ? (() => {
                      // Parse "€310 → €388 (+€77 injecté)" out of detail
                      const injMatch = ev.detail.match(/\+€([\d.]+)\s*injecté/);
                      const arrowMatch = ev.detail.match(/€([\d.]+)\s*→\s*€([\d.]+)/);
                      const pctMatch = ev.detail.match(/\+([\d.]+)%/);
                      if (injMatch && arrowMatch) {
                        const injected = injMatch[1];
                        const from     = arrowMatch[1];
                        const to       = arrowMatch[2];
                        const pct      = pctMatch?.[1];
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {/* Injected pill */}
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              background: "rgba(74,222,128,0.12)",
                              border: "1px solid rgba(74,222,128,0.22)",
                              color: "#4ade80", borderRadius: 99,
                              padding: "2px 8px", letterSpacing: "0.04em",
                              flexShrink: 0,
                            }}>
                              +€{injected}{pct ? ` · +${pct}%` : ""}
                            </span>
                            {/* Arrow */}
                            <span style={{ fontSize: 10, color: "#3f3f46", flexShrink: 0 }}>
                              €{from} → €{to}
                            </span>
                          </div>
                        );
                      }
                      // Fallback plain detail
                      return (
                        <p style={{ fontSize: 11, color: accentColor, opacity: 0.65, margin: 0, letterSpacing: "0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {ev.detail}
                        </p>
                      );
                    })() : (
                      <p style={{
                        fontSize: 11, color: accentColor, opacity: 0.65,
                        margin: 0, letterSpacing: "0.01em",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {ev.detail}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Bouton voir plus / réduire */}
            {!engineLoading && engineEvents.length > 5 && (
              <button
                onClick={() => setShowAllEvents(v => !v)}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "8px 0",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.28)",
                  transition: "all 0.18s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.28)"; }}
              >
                {showAllEvents ? "↑ Réduire" : `Voir les ${Math.min(engineEvents.length, 30)} derniers →`}
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — CAMPAIGN P&L
          Date range controls live HERE, attached to the table
      ═══════════════════════════════════════════════════════════════════ */}
      <motion.div {...s(3)} style={{ ...CARD, borderRadius: 28 }}>
        {/* Table header: title + date range + filter tabs */}
        <div style={{
          padding: "22px 26px 0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          {/* Left: title */}
          <div style={{ paddingBottom: 16 }}>
            <p style={LABEL}>Campaigns</p>
            <h2 style={{ fontSize: 20, fontWeight: 200, color: "rgba(255,255,255,0.88)", margin: "4px 0 0", letterSpacing: "-0.04em" }}>
              P&amp;L · Kill / Pause / Scale
            </h2>
          </div>

          {/* Right: date range + filter tabs stacked */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, paddingBottom: 14 }}>
            {/* Date range */}
            <DateSelector range={dateRange} onChange={handleDateChange} loading={loading} />

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 3 }}>
              {TABLE_FILTERS.map(tab => {
                const active = tableFilter === tab;
                const count  = tabCounts[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setTableFilter(tab)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 8, fontSize: 11,
                      cursor: "pointer", transition: "all 0.15s",
                      fontWeight: active ? 600 : 400,
                      background: active ? "rgba(139,92,246,0.14)" : "transparent",
                      color:      active ? "#a78bfa"               : "#52525b",
                      border:     active ? "1px solid rgba(139,92,246,0.22)" : "1px solid transparent",
                    }}
                  >
                    {tab}
                    {count > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        background: active ? "rgba(139,92,246,0.28)" : "rgba(255,255,255,0.06)",
                        color: active ? "#c4b5fd" : "#3f3f46",
                        borderRadius: 99, padding: "1px 5px",
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Campaign table — remount on filter change */}
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: isMobile ? 560 : "auto" }}>
            <CampaignsPnL key={tableFilter} initialCampaigns={filteredCampaigns} />
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — ANALYTICS OVERVIEW
      ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Row 1: Chart (8fr) + Summary (4fr) ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "8fr 4fr", gap: 14 }}>

        {/* Chart */}
        <motion.div {...s(4)} style={{
          ...CARD, padding: "26px 30px 22px",
          borderRadius: 28,
          background: [
            "radial-gradient(circle at 30% 8%, rgba(99,102,241,0.09), transparent 28%)",
            "radial-gradient(circle at 85% 70%, rgba(37,99,235,0.06), transparent 22%)",
            "#17171e",
          ].join(", "),
        }}>
          <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={LABEL}>Revenue &amp; profit</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
                <BigNum
                  value={zeroFmt(totals.totalRevenue, fmtEuro)}
                  color={zeroColor(totals.totalRevenue, "#a78bfa")}
                  size={42}
                />
                <span style={{
                  fontSize: 20, fontWeight: 200, letterSpacing: "-0.04em",
                  color: zeroColor(totals.totalProfit, profitPos ? "#4ade80" : "#f87171"),
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {totals.totalProfit >= 0 ? "+" : ""}{fmtEuro(totals.totalProfit)} profit
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, paddingTop: 4 }}>
              {[
                { dot: "#8b5cf6", label: "Revenue" },
                { dot: profitPos ? "#4ade80" : "#f87171", label: "Profit" },
              ].map(({ dot, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
                  <span style={{ fontSize: 9, color: "#3f3f46", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <ProfitChart data={chartData} profitPos={profitPos} height={230} />
        </motion.div>

        {/* Summary: best / worst / impressions */}
        <motion.div {...s(5)} style={{
          ...CARD, padding: "24px 20px",
          borderRadius: 28,
          display: "flex", flexDirection: "column", gap: 10,
          background: [
            "radial-gradient(circle at 22% 12%, rgba(236,72,153,0.06), transparent 22%)",
            "#17171e",
          ].join(", "),
        }}>
          <div style={{ marginBottom: 4 }}>
            <p style={LABEL}>Highlights</p>
          </div>

          {bestCampaign && bestCampaign.id !== worstCampaign?.id && (
            <CampaignSummaryRow camp={bestCampaign} variant="best" />
          )}

          {worstCampaign && (
            <CampaignSummaryRow camp={worstCampaign} variant="worst" />
          )}

          {!bestCampaign && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#3f3f46" }}>No campaign data</span>
            </div>
          )}

          {/* Impressions KPI */}
          <div style={{
            marginTop: "auto",
            padding: "16px 18px",
            background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.12)",
            borderRadius: 16,
          }}>
            <p style={{ ...LABEL, marginBottom: 8 }}>Impressions</p>
            <span style={{ fontSize: 36, fontWeight: 200, letterSpacing: "-0.06em", color: "#a78bfa", fontVariantNumeric: "tabular-nums" }}>
              {fmtBig(totals.totalImps)}
            </span>
            {/* Secondary metrics — separated by a thin rule for clarity */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(139,92,246,0.10)", display: "flex", gap: 0 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.13em", color: "#3f3f46" }}>Clicks</span>
                <span style={{
                  fontSize: 16, fontWeight: 300, letterSpacing: "-0.03em",
                  color: zeroColor(totals.totalClicks, "rgba(255,255,255,0.65)"),
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {fmtBig(totals.totalClicks)}
                </span>
              </div>
              <div style={{ width: "1px", background: "rgba(139,92,246,0.10)", margin: "0 14px", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.13em", color: "#3f3f46" }}>CTR</span>
                <span style={{
                  fontSize: 16, fontWeight: 300, letterSpacing: "-0.03em",
                  color: zeroColor(totals.ctr, "rgba(255,255,255,0.65)"),
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {totals.ctr === 0 ? "—" : `${totals.ctr.toFixed(2)}%`}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Row 2: Top connections (4fr) + Impression split (4fr) + World map (4fr) */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "4fr 4fr 4fr", gap: 14 }}>

        {/* Top connections */}
        <motion.div {...s(6)} style={{ ...CARD, padding: "24px 24px", borderRadius: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <p style={LABEL}>Top connections</p>
            <h3 style={{ fontSize: 20, fontWeight: 200, color: "rgba(255,255,255,0.80)", margin: "5px 0 0", letterSpacing: "-0.04em" }}>
              What brings the most
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topConnections.length > 0 ? topConnections.map((nb, i) => {
              const meta  = NET_META[nb.network] ?? { label: nb.network, color: "#52525b", rgb: "82,82,91" };
              const isPos = nb.profit >= 0;
              return (
                <motion.div
                  key={nb.network}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.35 }}
                  style={{
                    padding: "10px 14px",
                    background: isPos ? "rgba(16,185,129,0.05)" : "rgba(248,113,113,0.04)",
                    border: isPos ? "1px solid rgba(74,222,128,0.12)" : "1px solid rgba(248,113,113,0.10)",
                    borderRadius: 16,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, boxShadow: `0 0 6px ${meta.color}88`, flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 300, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.02em" }}>{meta.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: isPos ? "#4ade80" : "#f87171" }}>
                      {nb.roi >= 0 ? "+" : ""}{nb.roi.toFixed(1)}% ROI
                    </span>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.05em", color: isPos ? "#4ade80" : "#f87171", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {nb.profit >= 0 ? "+" : ""}{fmtEuro(nb.profit)}
                  </span>
                </motion.div>
              );
            }) : (
              <p style={{ fontSize: 12, color: "#3f3f46", textAlign: "center", padding: "24px 0" }}>No network data</p>
            )}
          </div>
        </motion.div>

        {/* Impression split by traffic type */}
        <motion.div {...s(7)} style={{ ...CARD, padding: "24px 24px", borderRadius: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <p style={LABEL}>Impressions</p>
            <h3 style={{ fontSize: 20, fontWeight: 200, color: "rgba(255,255,255,0.80)", margin: "5px 0 0", letterSpacing: "-0.04em" }}>
              By traffic type
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {impSplitFinal.length > 0 ? impSplitFinal.map(item => (
              <div key={item.label} style={{
                padding: "12px 14px",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14,
              }}>
                <ImpBar
                  label={item.label}
                  value={fmtBig(item.value)}
                  share={(item.value / impMax) * 100}
                  color={item.color}
                />
              </div>
            )) : (
              <p style={{ fontSize: 12, color: "#3f3f46", textAlign: "center", padding: "24px 0" }}>No impression data</p>
            )}
          </div>
        </motion.div>

        {/* World map — geo performance */}
        <motion.div {...s(8)} style={{
          ...CARD,
          borderRadius: 28,
          background: [
            "radial-gradient(circle at 30% 18%, rgba(37,99,235,0.22), transparent 28%)",
            "radial-gradient(circle at 72% 62%, rgba(139,92,246,0.10), transparent 20%)",
            "linear-gradient(180deg, rgba(3,8,18,0.95), rgba(8,10,16,0.98))",
          ].join(", "),
          overflow: "hidden",
        }}>
          <div style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <p style={LABEL}>World map</p>
              <h3 style={{ fontSize: 20, fontWeight: 200, color: "rgba(255,255,255,0.80)", margin: "4px 0 0", letterSpacing: "-0.04em" }}>
                Geo performance
              </h3>
            </div>
            <Globe2 size={14} color="#3f3f46" strokeWidth={1.5} />
          </div>
          <WorldMap
            dots={geoDots as Parameters<typeof WorldMap>[0]["dots"]}
            activeNetwork={activeNet}
            onNetworkChange={setActiveNet}
          />
        </motion.div>
      </div>

    </div>
  );
}
