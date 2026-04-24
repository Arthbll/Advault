"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Save, CheckCircle2, Zap, BookOpen, ShieldOff, Shield, Play, AlertCircle, RefreshCw, Power, ChevronDown, Lock, TrendingUp, Link2 } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { usePlan } from "@/hooks/usePlan";
import Link from "next/link";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C    = (op: number) => `rgba(255,255,255,${op})`;
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
function s(i: number) {
  return { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.38, delay: i * 0.05, ease: EASE } };
}

// ─── Preset data ──────────────────────────────────────────────────────────────
type PresetKey = "soft" | "balanced" | "aggressive" | "custom";
interface Preset {
  label: string;
  kill: number;  watchLow: number;
  scaleRoi: number; scaleInc: number;
  minSpend: number; minConv: number;
  killHold: number; scaleHold: number;
  killCd: number; scaleCd: number;
  maxKills: number; maxScales: number;
}
const PRESETS: Record<PresetKey, Preset> = {
  soft: {
    label: "Soft",
    kill: -35, watchLow: -20, scaleRoi: 35, scaleInc: 5,
    minSpend: 30, minConv: 4, killHold: 45, scaleHold: 90,
    killCd: 4, scaleCd: 8, maxKills: 3, maxScales: 1,
  },
  balanced: {
    label: "Balanced",
    kill: -30, watchLow: -15, scaleRoi: 30, scaleInc: 10,
    minSpend: 20, minConv: 3, killHold: 30, scaleHold: 60,
    killCd: 3, scaleCd: 6, maxKills: 5, maxScales: 2,
  },
  aggressive: {
    label: "Aggressive",
    kill: -20, watchLow: -10, scaleRoi: 20, scaleInc: 20,
    minSpend: 25, minConv: 2, killHold: 25, scaleHold: 45,
    killCd: 2, scaleCd: 4, maxKills: 8, maxScales: 4,
  },
  custom: {
    label: "Custom",
    kill: -30, watchLow: -15, scaleRoi: 30, scaleInc: 10,
    minSpend: 20, minConv: 3, killHold: 30, scaleHold: 60,
    killCd: 3, scaleCd: 6, maxKills: 5, maxScales: 2,
  },
};

// ─── Action row type ──────────────────────────────────────────────────────────
interface ActionRow {
  type:        string;
  camp:        string;
  ctx:         string;
  date:        string;
  r:           keyof typeof TONE;
  isRecommend: boolean;
}

const TONE = {
  rose:    { border: "rgba(251,113,133,0.16)", bg: "rgba(244,63,94,0.045)", text: "#fca5a5",  rowBg: "rgba(244,63,94,0.03)"  },
  amber:   { border: "rgba(251,191,36,0.16)",  bg: "rgba(245,158,11,0.04)", text: "#fcd34d",  rowBg: "rgba(245,158,11,0.025)" },
  emerald: { border: "rgba(52,211,153,0.16)",  bg: "rgba(16,185,129,0.04)", text: "#6ee7b7",  rowBg: "rgba(16,185,129,0.03)"  },
  violet:  { border: "rgba(139,92,246,0.20)",  bg: "rgba(139,92,246,0.045)", text: "#c4b5fd", rowBg: "rgba(139,92,246,0.025)" },
};

function mapAction(row: {
  type:         string;
  message:      string;
  createdAt:    string;
  campaignName?: string;
}): ActionRow {
  const cfg: Record<string, { label: string; r: keyof typeof TONE }> = {
    DECISION_KILL:  { label: "Kill",  r: "rose"    },
    DECISION_WATCH: { label: "Watch", r: "amber"   },
    DECISION_SCALE: { label: "Scale", r: "emerald" },
  };
  const mapped = cfg[row.type] ?? { label: row.type, r: "rose" as const };
  const d = new Date(row.createdAt);
  const dateStr =
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return {
    type:        mapped.label,
    camp:        row.campaignName ?? "Unknown campaign",
    ctx:         row.message,
    date:        dateStr,
    r:           mapped.r,
    isRecommend: false,
  };
}

// Empty initial state — real events load on mount
const FALLBACK_ACTIONS: ActionRow[] = [];

// ─── Small components ─────────────────────────────────────────────────────────
function DecisionBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      height: 28, padding: "0 10px",
      borderRadius: 999, border: `1px solid ${color}33`,
      background: `${color}11`,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
      textTransform: "uppercase", color,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function ModePill({ role, mode }: { role: "kill" | "watch" | "scale"; mode: "automatic" | "recommendation" }) {
  if (role === "watch") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "rgba(253,230,138,0.80)" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: "#fcd34d" }} />
        Signal only
      </span>
    );
  }
  if (mode === "automatic") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "rgba(167,243,208,0.80)" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: "#6ee7b7" }} />
        Automatic
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "rgba(196,181,253,0.80)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: "#a78bfa" }} />
      Recommendation
    </span>
  );
}

function ColLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.20em", color: C(0.22), ...style }}>
      {children}
    </div>
  );
}

function CustomFieldInline({
  label, value, unit, unitBefore, labelColor, borderColor, onChange, min, max,
}: {
  label: string; value: number; unit?: string; unitBefore?: boolean;
  labelColor: string; borderColor: string;
  onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
        letterSpacing: "0.18em", color: labelColor, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        {unitBefore && unit && (
          <span style={{ fontSize: 14, fontWeight: 300, color: labelColor, marginRight: 1 }}>{unit}</span>
        )}
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: 76,
            background: "transparent",
            border: "none",
            borderBottom: `1px solid ${borderColor}`,
            padding: "2px 0 5px",
            fontSize: 26,
            fontWeight: 200,
            letterSpacing: "-0.05em",
            color: C(0.90),
            outline: "none",
            colorScheme: "dark" as const,
          }}
          onFocus={e => {
            const stronger = borderColor.replace(/[\d.]+\)$/, (m) => {
              const v = parseFloat(m); return `${Math.min(v * 2.5, 0.7)})`;
            });
            e.currentTarget.style.borderBottomColor = stronger;
          }}
          onBlur={e => { e.currentTarget.style.borderBottomColor = borderColor; }}
        />
        {!unitBefore && unit && (
          <span style={{ fontSize: 14, fontWeight: 300, color: labelColor }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DecisionRulesPage() {
  const isMobile = useIsMobile();
  const { canUseAutomatic, plan: currentPlan } = usePlan();
  const [key,           setKey]           = useState<PresetKey>("balanced");
  const [saved,         setSaved]         = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [actions,       setActions]       = useState<ActionRow[]>(FALLBACK_ACTIONS);
  const [engineMode,    setEngineMode]    = useState<"automatic" | "recommendation">("automatic");
  const [engPaused,     setEngPaused]     = useState(false);
  const [pausedUntil,   setPausedUntil]   = useState<string | null>(null);
  const [pauseLoading,  setPauseLoading]  = useState(false);
  // ── Kill Switch master + Spend-only controls ──────────────────────────────
  const [killEnabled,      setKillEnabled]      = useState(false);
  const [spendOnly,        setSpendOnly]        = useState(false);
  const [maxSpend,         setMaxSpend]         = useState<number | null>(null);
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [timeWindowStart,  setTimeWindowStart]  = useState<number>(8);
  const [timeWindowEnd,    setTimeWindowEnd]    = useState<number>(22);
  // ── Custom mode editable values ───────────────────────────────────────────
  const [customValues,  setCustomValues]  = useState<Preset>({ ...PRESETS.balanced, label: "Custom" });
  function updateCustom(field: keyof Preset, val: number) {
    setCustomValues(prev => ({ ...prev, [field]: val }));
  }
  const [showCustomAdvanced, setShowCustomAdvanced] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayMode,    setOverlayMode]    = useState<"automatic" | "recommendation">("automatic");
  const [mounted,        setMounted]        = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [scanResult,     setScanResult]     = useState<{ checked: number; killed: number; scaled: number; skipped: number; errors: string[] } | null>(null);
  const [scanError,      setScanError]      = useState(false);
  // ── Revenue signal — determines if Profit Engine is available ─────────────
  const [hasRevenue,     setHasRevenue]     = useState<boolean | null>(null); // null = loading
  useEffect(() => setMounted(true), []);
  const p = key === "custom" ? customValues : PRESETS[key];

  // ── Load saved config on mount (UserSettings + DecisionRule) ─────────────
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((data: {
        settings?: { killSwitchEnabled?: boolean; spendOnlyMode?: boolean; maxSpendPerCampaign?: number | null };
        decision?: {
          preset?: string; engineMode?: string;
          killRoi?: number; watchLow?: number; scaleRoi?: number; scaleIncrement?: number;
          minSpend?: number; minConversions?: number; killHoldMin?: number; scaleHoldMin?: number;
          killCooldownH?: number; scaleCooldownH?: number; maxKillsDay?: number; maxScalesDay?: number;
          timeWindowStart?: number | null; timeWindowEnd?: number | null;
        };
      }) => {
        const s = data.settings ?? {};
        const d = data.decision ?? {};
        const validPresets: PresetKey[] = ["soft", "balanced", "aggressive", "custom"];
        if (d.preset && validPresets.includes(d.preset as PresetKey)) {
          setKey(d.preset as PresetKey);
        }
        if (d.engineMode === "recommendation" || d.engineMode === "automatic") {
          setEngineMode(d.engineMode as "automatic" | "recommendation");
        }
        setKillEnabled(s.killSwitchEnabled ?? false);
        setSpendOnly(s.spendOnlyMode ?? false);
        setMaxSpend(s.maxSpendPerCampaign ?? null);
        setTimeWindowEnabled(d.timeWindowStart != null && d.timeWindowEnd != null);
        setTimeWindowStart(d.timeWindowStart ?? 8);
        setTimeWindowEnd(d.timeWindowEnd ?? 22);
        // Restore custom values if preset is custom
        if (d.preset === "custom" && d.killRoi != null) {
          setCustomValues({
            label:     "Custom",
            kill:      d.killRoi        ?? -30,
            watchLow:  d.watchLow       ?? -15,
            scaleRoi:  d.scaleRoi       ?? 30,
            scaleInc:  d.scaleIncrement ?? 10,
            minSpend:  d.minSpend       ?? 20,
            minConv:   d.minConversions ?? 3,
            killHold:  d.killHoldMin    ?? 30,
            scaleHold: d.scaleHoldMin   ?? 60,
            killCd:    d.killCooldownH  ?? 3,
            scaleCd:   d.scaleCooldownH ?? 6,
            maxKills:  d.maxKillsDay    ?? 5,
            maxScales: d.maxScalesDay   ?? 2,
          });
        }
      })
      .catch(() => { /* keep default */ });

    // Load emergency stop state
    fetch("/api/engine/emergency-stop")
      .then(r => r.json())
      .then((d: { paused?: boolean; pausedUntil?: string | null }) => {
        setEngPaused(d.paused ?? false);
        setPausedUntil(d.pausedUntil ?? null);
      })
      .catch(() => {});

    // Check revenue signal for Profit Engine lock
    fetch("/api/revenue/signal")
      .then(r => r.json())
      .then((d: { hasRevenue?: boolean }) => setHasRevenue(d.hasRevenue ?? false))
      .catch(() => setHasRevenue(false));
  }, []);

  // ── Load recent engine actions on mount ───────────────────────────────────
  useEffect(() => {
    fetch("/api/engine/actions?limit=5")
      .then(r => r.json())
      .then((data: { events?: Array<{
        id: string; state: string; tone: "rose" | "amber" | "emerald";
        isRecommend?: boolean;
        campaign: string; network: string; detail: string;
        time: string; createdAt: string;
      }> }) => {
        if (Array.isArray(data.events) && data.events.length > 0) {
          setActions(data.events.map(ev => ({
            type:        ev.isRecommend
              ? (ev.state === "SCALE" ? "Suggest scale" : ev.state === "WATCH" ? "Watch" : "Suggest pause")
              : (ev.state === "KILL" ? "Kill" : ev.state === "WATCH" ? "Watch" : "Scale"),
            camp:        ev.campaign || "Campaign",
            ctx:         ev.detail,
            date:        ev.time,
            r:           ev.isRecommend ? "violet" : ev.tone,
            isRecommend: ev.isRecommend ?? false,
          })));
        }
        // if empty, keep empty array (no fake fallback data)
      })
      .catch(() => { /* keep empty */ });
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // UserSettings
          killSwitchEnabled:   killEnabled,
          spendOnlyMode:       spendOnly,
          maxSpendPerCampaign: maxSpend,
          roiThreshold:        p.kill,
          // DecisionRule
          preset:         key,
          engineMode,
          killRoi:        p.kill,
          watchLow:       p.watchLow,
          watchHigh:      0,
          scaleRoi:       p.scaleRoi,
          scaleIncrement: p.scaleInc,
          minSpend:       p.minSpend,
          minConversions: p.minConv,
          killHoldMin:    p.killHold,
          scaleHoldMin:   p.scaleHold,
          killCooldownH:  p.killCd,
          scaleCooldownH: p.scaleCd,
          maxKillsDay:    p.maxKills,
          maxScalesDay:   p.maxScales,
          timeWindowStart: timeWindowEnabled ? timeWindowStart : null,
          timeWindowEnd:   timeWindowEnabled ? timeWindowEnd   : null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      // silent — UI stays intact
    } finally {
      setSaving(false);
    }
  }

  // ── Emergency stop ─────────────────────────────────────────────────────────
  async function handleEmergencyStop() {
    setPauseLoading(true);
    try {
      const res  = await fetch("/api/engine/emergency-stop", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: engPaused ? "resume" : "pause", durationH: 24 }),
      });
      const data = await res.json() as { paused?: boolean; pausedUntil?: string | null };
      setEngPaused(data.paused ?? false);
      setPausedUntil(data.pausedUntil ?? null);
    } catch { /* silent */ } finally {
      setPauseLoading(false);
    }
  }

  function fmtPausedUntil(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
           " on " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function handleModeSwitch(m: "automatic" | "recommendation") {
    if (m === engineMode) return;
    setEngineMode(m);
    setOverlayMode(m);
    setOverlayVisible(true);
    setTimeout(() => setOverlayVisible(false), 900);
  }

  async function handleRunScan() {
    setScanning(true);
    setScanResult(null);
    setScanError(false);
    try {
      const res = await fetch("/api/kill-switch/run", { method: "POST" });
      const data = await res.json() as { ok: boolean; checked?: number; killed?: number; scaled?: number; skipped?: number; errors?: string[] };
      if (!data.ok) throw new Error("Scan failed");
      setScanResult({
        checked: data.checked ?? 0,
        killed:  data.killed  ?? 0,
        scaled:  data.scaled  ?? 0,
        skipped: data.skipped ?? 0,
        errors:  data.errors  ?? [],
      });
      // Rafraîchir le feed d'actions après le scan
      fetch("/api/engine/actions?limit=5")
        .then(r => r.json())
        .then((d: { events?: Array<{ id: string; state: string; tone: "rose"|"amber"|"emerald"; isRecommend?: boolean; campaign: string; network: string; detail: string; time: string }> }) => {
          if (Array.isArray(d.events) && d.events.length > 0) {
            setActions(d.events.map(ev => ({
              type:        ev.isRecommend
                ? (ev.state === "SCALE" ? "Suggest scale" : ev.state === "WATCH" ? "Watch" : "Suggest pause")
                : (ev.state === "KILL" ? "Kill" : ev.state === "WATCH" ? "Watch" : "Scale"),
              camp:        ev.campaign || "Campaign",
              ctx:         ev.detail,
              date:        ev.time,
              r:           ev.isRecommend ? "violet" : ev.tone,
              isRecommend: ev.isRecommend ?? false,
            })));
          }
        })
        .catch(() => {});
      setTimeout(() => setScanResult(null), 8000);
    } catch {
      setScanError(true);
      setTimeout(() => setScanError(false), 4000);
    } finally {
      setScanning(false);
    }
  }

  const safetyRows: [string, string][] = [
    ["Min spend before any decision",  `€${p.minSpend}`],
    ["Min conversions before scale",   String(p.minConv)],
    ["Kill hold time",                 `${p.killHold} min`],
    ["Scale hold time",                `${p.scaleHold} min`],
    ["Kill cooldown",                  `${p.killCd}h`],
    ["Scale cooldown",                 `${p.scaleCd}h`],
    ["Max kills / day",                String(p.maxKills)],
    ["Max scales / day",               String(p.maxScales)],
    ["Scale increment",                `+${p.scaleInc}%`],
  ];

  // ── Shared sub-components (render scope) ──────────────────────────────────
  const LINE   = "rgba(255,255,255,0.08)";
  const GREEN  = { color: "#75e39f", bg: "rgba(117,227,159,0.12)" };
  const AMBER  = { color: "#f3c661", bg: "rgba(243,198,97,0.12)"  };
  const RED_S  = { color: "#ff8d8d", bg: "rgba(255,141,141,0.12)" };
  const PURPLE = { color: "#d7d0ff", bg: "rgba(127,108,255,0.14)" };

  function StatusTag({ v, children }: { v: "ok"|"warn"|"bad"|"info"; children: React.ReactNode }) {
    const m = { ok: GREEN, warn: AMBER, bad: RED_S, info: PURPLE }[v];
    return (
      <span style={{ display:"inline-flex", alignItems:"center", padding:"6px 11px", borderRadius:999, fontSize:12, fontWeight:700, background:m.bg, color:m.color, whiteSpace:"nowrap" as const }}>
        {children}
      </span>
    );
  }

  function StatusRow({ label, sub, v }: { label:string; sub:string; v:"ok"|"warn"|"bad"|"info" }) {
    return (
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, border:`1px solid ${LINE}`, borderRadius:14, padding:"11px 14px", background:"rgba(255,255,255,0.02)" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:C(0.88) }}>{label}</div>
          <div style={{ fontSize:11, color:C(0.38), marginTop:2 }}>{sub}</div>
        </div>
        <StatusTag v={v}>{v==="ok"?"Live":v==="bad"?"Missing":v==="warn"?"Waiting":"Active"}</StatusTag>
      </div>
    );
  }

  function SCard({ children, style }: { children:React.ReactNode; style?: React.CSSProperties }) {
    return (
      <div style={{ border:`1px solid ${LINE}`, borderRadius:22, padding:20, background:"rgba(255,255,255,0.02)", ...style }}>
        {children}
      </div>
    );
  }

  function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
    return (
      <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:"0.22em", color: color ?? C(0.30), marginBottom:12 }}>
        {children}
      </div>
    );
  }

  const budgetRuleRows: [string, string, string, string][] = [
    ["Budget Protection", maxSpend != null ? `Spend > €${maxSpend}` : "No cap set", "Pause / Kill", engineMode === "automatic" ? "Automatic" : "Recommend"],
    ["Budget Alert",      "80% of budget",                                            "Alert only",  "Immediate"],
  ];

  const profitRuleRows: [string, string, string, string, "ok"|"bad"][] = [
    ["Kill",  `ROI < ${p.kill}%`,                  "Pause campaign",   engineMode === "automatic" ? "Automatic" : "Recommend", hasRevenue ? "ok" : "bad"],
    ["Watch", `ROI ${p.watchLow}% → 0%`,           "Flag for review",  "Signal only",                                         hasRevenue ? "ok" : "bad"],
    ["Scale", `ROI > +${p.scaleRoi}%`,             `Bid +${p.scaleInc}%`, engineMode === "automatic" ? "Automatic" : "Recommend", hasRevenue ? "ok" : "bad"],
  ];

  return (
    <div style={{ padding: isMobile ? "16px 12px 80px" : "28px 28px 64px", maxWidth: 1500, margin: "0 auto" }}>

      {/* ── Mode transition toast (portal → body, ancré en haut sous le navbar) */}
      {mounted && createPortal(
      <AnimatePresence>
        {overlayVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position:       "fixed",
              inset:          0,
              zIndex:         9999,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              pointerEvents:  "none",
            }}
          >
            {/* Backdrop */}
            <div style={{
              position:       "absolute",
              inset:          0,
              backdropFilter: "blur(4px)",
              background:     "rgba(4,5,10,0.52)",
            }} />
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.98,  y: -8 }}
              transition={{ duration: 0.22, ease: EASE }}
              style={{
                position:       "relative",
                borderRadius:   32,
                border:         overlayMode === "automatic"
                  ? "1px solid rgba(52,211,153,0.22)"
                  : "1px solid rgba(139,92,246,0.24)",
                background:     "linear-gradient(180deg,rgba(13,15,24,0.96),rgba(8,10,17,0.96))",
                padding:        isMobile ? "24px 20px" : "44px 64px",
                textAlign:      "center",
                backdropFilter: "blur(32px)",
                boxShadow:      "0 40px 100px rgba(0,0,0,0.65)",
                overflow:       "hidden",
                minWidth:       isMobile ? "calc(100vw - 32px)" : 460,
              }}
            >
              {/* Glow */}
              <div style={{
                position:      "absolute", inset: 0, borderRadius: 32, pointerEvents: "none",
                background:    overlayMode === "automatic"
                  ? "radial-gradient(circle at 50% 0%,rgba(52,211,153,0.12),transparent 55%)"
                  : "radial-gradient(circle at 50% 0%,rgba(139,92,246,0.16),transparent 55%)",
              }} />
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: "0.28em", marginBottom: 18,
                color: overlayMode === "automatic" ? "rgba(110,231,183,0.60)" : "rgba(167,139,250,0.60)",
              }}>
                Engine mode
              </div>
              <div style={{
                fontSize: isMobile ? 36 : 56, fontWeight: 200, letterSpacing: "-0.07em", lineHeight: 1,
                color: overlayMode === "automatic" ? "rgba(167,243,208,0.96)" : "rgba(196,181,253,0.96)",
              }}>
                {overlayMode === "automatic" ? "Automatic" : "Recommendation"}
              </div>
              <div style={{
                marginTop: 16, fontSize: 14, color: C(0.40), letterSpacing: "-0.01em",
              }}>
                {overlayMode === "automatic"
                  ? "Real execution · Kill and Scale act automatically"
                  : "Dry-run only · The engine suggests instead of executing"}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── Outer card ─────────────────────────────────────────────────────── */}
      <motion.div {...s(0)} style={{
        borderRadius: 28,
        border:       `1px solid ${C(0.08)}`,
        overflow:     "hidden",
        background:   "linear-gradient(180deg,rgba(11,12,18,0.98),rgba(7,8,12,0.99))",
        boxShadow:    "0 32px 100px rgba(0,0,0,0.38)",
      }}>

        {/* ── A. Header ──────────────────────────────────────────────────── */}
        <div style={{
          padding:      "28px 32px",
          borderBottom: `1px solid ${C(0.06)}`,
          background:   "radial-gradient(circle at 16% 0%,rgba(99,102,241,0.08),transparent 28%),radial-gradient(circle at 84% 0%,rgba(16,185,129,0.06),transparent 22%)",
          display:      "flex",
          alignItems:   "flex-end",
          justifyContent: "space-between",
          gap:          isMobile ? 8 : 24,
          flexWrap:     "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.22) }}>
              Decision Rules
            </div>
            <h1 style={{ margin: "10px 0 0", fontSize: isMobile ? 22 : 32, fontWeight: 300, letterSpacing: "-0.05em", lineHeight: 1.15, color: C(0.92) }}>
              Set when ProfitDash kills, flags, and scales campaigns.
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

            {/* ── Engine master toggle ──────────────────────────────────── */}
            <button
              onClick={() => setKillEnabled(v => !v)}
              style={{
                height: 40, padding: "0 14px", borderRadius: 12,
                border: killEnabled
                  ? "1px solid rgba(74,222,128,0.30)"
                  : "1px solid rgba(255,255,255,0.10)",
                background: killEnabled
                  ? "rgba(74,222,128,0.10)"
                  : "rgba(255,255,255,0.04)",
                color: killEnabled ? "#86efac" : C(0.40),
                fontSize: 12, fontWeight: 600,
                cursor: "pointer", transition: "all 0.22s ease",
                display: "flex", alignItems: "center", gap: 7,
                whiteSpace: "nowrap" as const,
              }}
            >
              <Power size={13} strokeWidth={2} />
              {killEnabled ? "Engine ON" : "Engine OFF"}
            </button>

            {/* ── Bloc 5: Engine Mode Toggle ─────────────────────────────── */}
            <div style={{ position: "relative" }}>
              <div style={{
                display:      "flex",
                alignItems:   "center",
                borderRadius: 14,
                border:       `1px solid ${engineMode === "automatic" ? "rgba(74,222,128,0.22)" : "rgba(139,92,246,0.20)"}`,
                background:   engineMode === "automatic" ? "rgba(74,222,128,0.06)" : "rgba(139,92,246,0.06)",
                padding:      3,
                gap:          2,
                transition:   "all 0.25s ease",
                opacity:      canUseAutomatic ? 1 : 0.6,
              }}>
                {(["recommendation", "automatic"] as const).map(m => {
                  const isActive = engineMode === m;
                  const Icon = m === "automatic" ? Zap : BookOpen;
                  const isLocked = m === "automatic" && !canUseAutomatic;
                  return (
                    <button
                      key={m}
                      onClick={() => isLocked ? null : handleModeSwitch(m)}
                      title={isLocked ? `Automatic mode — available on Dominion. ${currentPlan.upgradeLabel}` : undefined}
                      style={{
                        height:        34,
                        padding:       "0 13px",
                        borderRadius:  11,
                        border:        "none",
                        background:    isActive
                          ? m === "automatic" ? "rgba(74,222,128,0.16)" : "rgba(139,92,246,0.18)"
                          : "transparent",
                        color:         isActive
                          ? m === "automatic" ? "#86efac" : "rgba(196,181,253,1)"
                          : C(0.38),
                        fontSize:      12,
                        fontWeight:    isActive ? 600 : 400,
                        cursor:        isLocked ? "not-allowed" : "pointer",
                        transition:    "all 0.18s ease",
                        display:       "flex",
                        alignItems:    "center",
                        gap:           5,
                        whiteSpace:    "nowrap" as const,
                      }}
                    >
                      {isLocked ? <Lock size={10} strokeWidth={2} /> : <Icon size={11} />}
                      {m === "automatic" ? "Automatic" : "Recommend"}
                    </button>
                  );
                })}
              </div>
              {/* Badge "Dominion only" si le mode automatique est verrouillé */}
              {!canUseAutomatic && (
                <Link
                  href="/dashboard/settings?tab=plan"
                  style={{
                    position: "absolute", top: -8, right: -8,
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 7px", borderRadius: 99,
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    fontSize: 9, fontWeight: 700, color: "rgba(196,181,253,0.9)",
                    textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Lock size={7} strokeWidth={2.5} /> Dominion
                </Link>
              )}
            </div>

            {/* Preset segmented control */}
            <div style={{
              display:      "flex",
              alignItems:   "center",
              borderRadius: 14,
              border:       `1px solid ${C(0.10)}`,
              background:   C(0.03),
              padding:      3,
              gap:          2,
            }}>
              {(["soft", "balanced", "aggressive", "custom"] as PresetKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => setKey(k)}
                  style={{
                    height:        36,
                    padding:       "0 16px",
                    borderRadius:  11,
                    border:        "none",
                    background:    key === k ? "rgba(139,92,246,0.18)" : "transparent",
                    color:         key === k ? "rgba(196,181,253,1)" : C(0.48),
                    fontSize:      13,
                    fontWeight:    key === k ? 600 : 400,
                    cursor:        "pointer",
                    transition:    "all 0.18s ease",
                    outline:       key === k ? "1px solid rgba(139,92,246,0.26)" : "none",
                    outlineOffset: "-1px",
                    letterSpacing: "0.01em",
                    textTransform: "capitalize",
                  }}
                >
                  {PRESETS[k].label}
                </button>
              ))}
            </div>

            {/* Run scan */}
            <button
              onClick={handleRunScan}
              disabled={scanning}
              style={{
                height:       40,
                padding:      "0 16px",
                borderRadius: 12,
                border:       scanError
                  ? "1px solid rgba(251,113,133,0.30)"
                  : scanResult
                    ? "1px solid rgba(52,211,153,0.30)"
                    : engineMode === "automatic"
                      ? "1px solid rgba(52,211,153,0.22)"
                      : "1px solid rgba(139,92,246,0.22)",
                background:   scanError
                  ? "rgba(244,63,94,0.08)"
                  : scanResult
                    ? "rgba(16,185,129,0.10)"
                    : engineMode === "automatic"
                      ? "rgba(16,185,129,0.07)"
                      : "rgba(139,92,246,0.07)",
                color:        scanError
                  ? "#fca5a5"
                  : scanResult
                    ? "rgba(167,243,208,0.95)"
                    : engineMode === "automatic"
                      ? "rgba(167,243,208,0.85)"
                      : "rgba(196,181,253,0.85)",
                fontSize:     12,
                fontWeight:   600,
                cursor:       scanning ? "default" : "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          7,
                opacity:      scanning ? 0.6 : 1,
                transition:   "all 0.22s ease",
                whiteSpace:   "nowrap" as const,
              }}
            >
              {scanError ? (
                <><AlertCircle size={13} />Error</>
              ) : scanning ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} style={{ display: "flex" }}>
                    <RefreshCw size={13} />
                  </motion.div>
                  Scanning…
                </>
              ) : scanResult ? (
                <>
                  <CheckCircle2 size={13} />
                  {engineMode === "automatic"
                    ? `${scanResult.checked} checked · ${scanResult.killed} killed · ${scanResult.scaled} scaled`
                    : `${scanResult.checked} checked · ${scanResult.killed} suggestions · ${scanResult.scaled} to scale`}
                </>
              ) : (
                <>
                  <Play size={11} />
                  {engineMode === "automatic" ? "Run scan" : "Preview scan"}
                </>
              )}
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                height:       40,
                padding:      "0 18px",
                borderRadius: 12,
                border:       "none",
                background:   saved
                  ? "linear-gradient(90deg,#10b981,#059669)"
                  : "linear-gradient(90deg,#8b5cf6,#7c3aed)",
                color:        "#fff",
                fontSize:     13,
                fontWeight:   600,
                cursor:       saving ? "default" : "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          7,
                opacity:      saving ? 0.65 : 1,
                boxShadow:    saved ? "none" : "0 4px 18px rgba(139,92,246,0.24)",
                transition:   "background 0.3s ease, opacity 0.2s ease",
                whiteSpace:   "nowrap",
              }}
            >
              {saved ? <><CheckCircle2 size={14} />Saved</> : <><Save size={14} />{saving ? "Saving…" : "Save changes"}</>}
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── 1. Engine state topbar ────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr", gap: 16 }}>

            {/* Engine state card */}
            <SCard style={{
              background: hasRevenue
                ? "linear-gradient(180deg,rgba(52,211,153,0.07),rgba(52,211,153,0.02))"
                : "linear-gradient(180deg,rgba(243,198,97,0.07),rgba(243,198,97,0.02))",
              border: hasRevenue
                ? "1px solid rgba(52,211,153,0.22)"
                : "1px solid rgba(243,198,97,0.22)",
            }}>
              <Eyebrow color={hasRevenue ? "rgba(52,211,153,0.55)" : "rgba(243,198,97,0.55)"}>
                Engine state
              </Eyebrow>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const, marginBottom: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em", color: C(0.92) }}>
                  {hasRevenue ? "Profit Engine active" : "Budget Protection active"}
                </div>
                <StatusTag v={hasRevenue ? "ok" : "warn"}>
                  {hasRevenue ? "Revenue live" : "Revenue missing"}
                </StatusTag>
              </div>
              {hasRevenue ? (
                <div style={{ fontSize: 12, color: "rgba(167,243,208,0.55)", lineHeight: 1.6 }}>
                  ROI-based decisions are active. Kill, Watch, and Scale rules are running on live revenue data.
                </div>
              ) : (
                <div style={{
                  background: "rgba(243,198,97,0.06)",
                  border: "1px solid rgba(243,198,97,0.14)",
                  borderRadius: 14, padding: "14px 16px", marginTop: 6,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(253,230,138,0.85)", marginBottom: 5 }}>
                    Profit-based decisions are locked
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(253,230,138,0.50)", lineHeight: 1.6, marginBottom: 12 }}>
                    Connect your postback to unlock ROI Kill, Watch, and Scale.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                    <a href="/dashboard/settings?tab=postbacks" style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11, fontWeight: 600,
                      color: "rgba(14,165,233,0.85)",
                      border: "1px solid rgba(14,165,233,0.22)",
                      background: "rgba(14,165,233,0.08)",
                      borderRadius: 8, padding: "6px 12px", textDecoration: "none",
                    }}>
                      <Link2 size={10} />
                      Connect revenue signal
                    </a>
                    <a href="/dashboard/settings?tab=postbacks" style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11, fontWeight: 600,
                      color: C(0.50),
                      border: `1px solid ${LINE}`,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8, padding: "6px 12px", textDecoration: "none",
                    }}>
                      Test postback
                    </a>
                  </div>
                </div>
              )}
            </SCard>

            {/* Live status card */}
            <SCard>
              <Eyebrow>Live status</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StatusRow label="Network data"   sub="Spend & impressions synced"  v="ok" />
                <StatusRow label="Revenue signal" sub="Postback conversion data"    v={hasRevenue ? "ok" : "bad"} />
                <StatusRow label="Profit Engine"  sub="ROI-based decisions"         v={hasRevenue ? "ok" : "bad"} />
              </div>
            </SCard>
          </div>

          {/* ── 2. Budget Protection | Profit Engine ─────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>

            {/* ── Left: Budget Protection ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <Shield size={13} color="rgba(251,191,36,0.65)" strokeWidth={1.5} />
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.22em",
                  textTransform: "uppercase" as const, color: "rgba(251,191,36,0.55)",
                }}>Budget Protection</span>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  ["Max spend / campaign", maxSpend != null ? `€${maxSpend}` : "No cap"],
                  ["Kill hold time",       `${p.killHold} min`],
                  ["Cooldown",             `${p.killCd}h`],
                  ["Max kills / day",      String(p.maxKills)],
                ] as [string, string][]).map(([lbl, val]) => (
                  <div key={lbl} style={{
                    borderRadius: 12, border: `1px solid ${LINE}`,
                    background: "rgba(255,255,255,0.02)", padding: "11px 13px",
                  }}>
                    <div style={{ fontSize: 10, color: C(0.32), marginBottom: 5 }}>{lbl}</div>
                    <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Spend-only toggle */}
              <div style={{
                borderRadius: 13,
                border: spendOnly ? "1px solid rgba(251,191,36,0.18)" : `1px solid ${LINE}`,
                background: spendOnly ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                padding: "13px 15px", transition: "all 0.25s ease",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <button onClick={() => setSpendOnly(v => !v)} style={{
                  flexShrink: 0, width: 38, height: 20, borderRadius: 99,
                  background: spendOnly ? "#fbbf24" : "rgba(255,255,255,0.10)",
                  border: "none", cursor: "pointer", position: "relative" as const,
                  transition: "background 0.22s",
                }}>
                  <motion.div
                    animate={{ left: spendOnly ? 19 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    style={{
                      position: "absolute" as const, top: 2, width: 16, height: 16,
                      borderRadius: "50%", background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    }}
                  />
                </button>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: spendOnly ? "rgba(253,230,138,0.90)" : C(0.70) }}>
                    Spend-only mode
                  </div>
                  <div style={{ fontSize: 11, color: C(0.30) }}>
                    {spendOnly ? "Kill on budget cap only" : "For networks without tracker"}
                  </div>
                </div>
              </div>

              {/* Max spend cap input */}
              <div style={{
                borderRadius: 13, border: `1px solid ${LINE}`,
                background: "rgba(255,255,255,0.02)", padding: "12px 15px",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.16em", color: C(0.28), marginBottom: 8 }}>
                  Max spend / campaign
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: C(0.40) }}>€</span>
                  <input
                    type="number" min={0} step={1} value={maxSpend ?? ""} placeholder="No cap"
                    onChange={e => { const v = e.target.value; setMaxSpend(v === "" ? null : Number(v)); }}
                    style={{
                      width: 110, padding: "6px 10px", borderRadius: 8, fontSize: 13,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: C(0.85), outline: "none", colorScheme: "dark" as const,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                  />
                </div>
              </div>

              {/* Active hours */}
              <div style={{
                borderRadius: 13,
                border: timeWindowEnabled ? "1px solid rgba(99,102,241,0.22)" : `1px solid ${LINE}`,
                background: timeWindowEnabled ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.02)",
                padding: "13px 15px", transition: "all 0.25s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: timeWindowEnabled ? 12 : 0 }}>
                  <button onClick={() => setTimeWindowEnabled(v => !v)} style={{
                    flexShrink: 0, width: 38, height: 20, borderRadius: 99,
                    background: timeWindowEnabled ? "#6366f1" : "rgba(255,255,255,0.10)",
                    border: "none", cursor: "pointer", position: "relative" as const,
                    transition: "background 0.22s",
                  }}>
                    <motion.div
                      animate={{ left: timeWindowEnabled ? 19 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      style={{
                        position: "absolute" as const, top: 2, width: 16, height: 16,
                        borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      }}
                    />
                  </button>
                  <div style={{ fontSize: 12, fontWeight: 600, color: timeWindowEnabled ? "rgba(165,180,252,0.90)" : C(0.70) }}>
                    Active hours
                  </div>
                  {!timeWindowEnabled && (
                    <div style={{ fontSize: 11, color: C(0.30) }}>Engine runs 24/7 by default</div>
                  )}
                </div>
                {timeWindowEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <select value={timeWindowStart} onChange={e => setTimeWindowStart(Number(e.target.value))} style={{ padding: "5px 8px", borderRadius: 8, fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: C(0.85), outline: "none", colorScheme: "dark" as const }}>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: C(0.30) }}>→</span>
                    <select value={timeWindowEnd} onChange={e => setTimeWindowEnd(Number(e.target.value))} style={{ padding: "5px 8px", borderRadius: 8, fontSize: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: C(0.85), outline: "none", colorScheme: "dark" as const }}>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: C(0.25) }}>UTC</span>
                  </div>
                )}
              </div>

              {/* Budget rules table */}
              <div style={{ borderRadius: 14, border: `1px solid ${LINE}`, overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 90px", gap: 8, padding: "9px 14px", borderBottom: `1px solid ${LINE}` }}>
                  <ColLabel>Rule</ColLabel>
                  <ColLabel>Trigger</ColLabel>
                  <ColLabel>Action</ColLabel>
                  <ColLabel>Mode</ColLabel>
                </div>
                {budgetRuleRows.map(([, trigger, action, mode], i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 80px 90px", gap: 8,
                    padding: "12px 14px", alignItems: "center",
                    borderBottom: i < budgetRuleRows.length - 1 ? `1px solid ${LINE}` : "none",
                    background: i === 0 ? "rgba(251,191,36,0.025)" : "transparent",
                  }}>
                    <div>
                      <DecisionBadge label={i === 0 ? "Protect" : "Alert"} color={i === 0 ? "#fbbf24" : "#60a5fa"} />
                    </div>
                    <div style={{ fontSize: 12, color: C(0.62) }}>{trigger}</div>
                    <div style={{ fontSize: 12, color: C(0.62) }}>{action}</div>
                    <div style={{ fontSize: 11, color: C(0.38) }}>{mode}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Profit Engine ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" as const, marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={13} color={hasRevenue ? "rgba(52,211,153,0.65)" : "rgba(255,255,255,0.20)"} strokeWidth={1.5} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.22em",
                    textTransform: "uppercase" as const,
                    color: hasRevenue ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.22)",
                  }}>Profit Engine</span>
                </div>
                {hasRevenue === false && (
                  <a href="/dashboard/settings?tab=postbacks" style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, color: "rgba(14,165,233,0.80)",
                    border: "1px solid rgba(14,165,233,0.20)", background: "rgba(14,165,233,0.06)",
                    borderRadius: 8, padding: "4px 10px", textDecoration: "none",
                  }}>
                    <Link2 size={10} />Set up postback
                  </a>
                )}
              </div>

              {!hasRevenue ? (
                /* ── Locked state ── */
                <>
                  <SCard style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 12, padding: 28, textAlign: "center" as const }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Lock size={18} color="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C(0.55) }}>Profit Engine locked</div>
                    <div style={{ fontSize: 12, color: C(0.28), lineHeight: 1.65, maxWidth: 240 }}>
                      Profit Engine unlocks only when a reliable revenue signal is live.
                    </div>
                  </SCard>
                  {(["Kill", "Watch", "Scale"] as const).map((lbl, i) => {
                    const clr = (["#f87171", "#fbbf24", "#34d399"] as const)[i];
                    const trig = [
                      `ROI < ${p.kill}%`,
                      `ROI ${p.watchLow}% → 0%`,
                      `ROI > +${p.scaleRoi}%`,
                    ][i];
                    return (
                      <div key={lbl} style={{
                        borderRadius: 14, border: `1px solid ${LINE}`,
                        background: "rgba(255,255,255,0.015)", padding: "14px 16px",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        opacity: 0.55,
                      }}>
                        <div>
                          <DecisionBadge label={lbl} color={clr} />
                          <div style={{ fontSize: 11, color: C(0.35), marginTop: 6 }}>{trig}</div>
                        </div>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 8,
                          border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)",
                          fontSize: 11, fontWeight: 600, color: C(0.30),
                        }}>
                          <Lock size={10} color={C(0.28)} />
                          Locked
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : (
                /* ── Active state ── */
                <>
                  {/* Preset cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {(["soft", "balanced", "aggressive", "custom"] as PresetKey[]).map(k => (
                      <button key={k} onClick={() => setKey(k)} style={{
                        borderRadius: 14,
                        border: key === k ? "1px solid rgba(139,92,246,0.28)" : `1px solid ${LINE}`,
                        background: key === k ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.02)",
                        padding: "14px 16px", cursor: "pointer", textAlign: "left" as const,
                        transition: "all 0.18s ease",
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: key === k ? "rgba(196,181,253,0.95)" : C(0.75), marginBottom: 4 }}>
                          {PRESETS[k].label}
                        </div>
                        <div style={{ fontSize: 11, color: C(0.32) }}>
                          Kill {PRESETS[k].kill}% · Scale +{PRESETS[k].scaleRoi}%
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Active rules table */}
                  <div style={{ borderRadius: 16, border: `1px solid ${LINE}`, overflow: "hidden", background: "linear-gradient(180deg,rgba(14,15,23,0.96),rgba(8,9,14,0.98))" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 100px", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${LINE}` }}>
                      <ColLabel>Decision</ColLabel>
                      <ColLabel>Trigger</ColLabel>
                      <ColLabel>Action</ColLabel>
                      <ColLabel>Mode</ColLabel>
                    </div>
                    {profitRuleRows.map(([rule, trigger, action], i) => {
                      const toneArr = [TONE.rose, TONE.amber, TONE.emerald];
                      const clrArr  = ["#f87171", "#fbbf24", "#34d399"];
                      const roleArr = ["kill", "watch", "scale"] as const;
                      const t = toneArr[i];
                      const c = clrArr[i];
                      return (
                        <div key={i} style={{
                          display: "grid", gridTemplateColumns: "110px 1fr 1fr 100px", gap: 12,
                          padding: "15px 16px", alignItems: "center",
                          borderBottom: i < profitRuleRows.length - 1 ? `1px solid ${LINE}` : "none",
                          background: t.rowBg,
                        }}>
                          <div><DecisionBadge label={rule} color={c} /></div>
                          <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.88) }}>{trigger}</div>
                          <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.88) }}>{action}</div>
                          <ModePill role={roleArr[i]} mode={engineMode} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Safety controls */}
                  <div style={{ borderRadius: 14, border: `1px solid ${LINE}`, overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
                    <div style={{ padding: "9px 14px", borderBottom: `1px solid ${LINE}` }}>
                      <ColLabel>Safety controls</ColLabel>
                    </div>
                    <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      {safetyRows.map(([lbl, val]) => (
                        <motion.div key={`${lbl}-${key}`} {...s(0)} style={{
                          borderRadius: 10, border: `1px solid ${LINE}`,
                          background: "rgba(0,0,0,0.10)", padding: "9px 12px",
                          display: "flex", flexDirection: "column", gap: 3,
                        }}>
                          <div style={{ fontSize: 11, color: C(0.36), lineHeight: 1.4 }}>{lbl}</div>
                          <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.03em", color: C(0.90) }}>{val}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── 3. Custom mode editor ─────────────────────────────────── */}
          <AnimatePresence>
            {key === "custom" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: EASE }}
                style={{
                  borderRadius: 18,
                  border: `1px solid ${C(0.08)}`,
                  overflow: "hidden",
                  background: "linear-gradient(180deg,rgba(14,15,23,0.96),rgba(8,9,14,0.98))",
                }}
              >
                {/* Header */}
                <div style={{
                  padding: "12px 24px",
                  borderBottom: `1px solid ${C(0.05)}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,0.015)",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.28) }}>
                    Custom thresholds
                  </div>
                  <div style={{ fontSize: 11, color: C(0.25) }}>
                    Modifie directement · sauvegardé avec « Save changes »
                  </div>
                </div>

                {/* ── Champs principaux : 3 zones côte à côte ─────────── */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr" }}>

                  {/* — Kill zone — */}
                  <div style={{ padding: "22px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.05)}`, borderBottom: isMobile ? `1px solid ${C(0.05)}` : "none", background: "rgba(244,63,94,0.022)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(248,113,113,0.55)", marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />Kill
                    </div>
                    <CustomFieldInline label="ROI trigger" value={customValues.kill} unit="%" labelColor="rgba(248,113,113,0.45)" borderColor="rgba(248,113,113,0.20)" min={-100} max={-1} onChange={v => updateCustom("kill", v)} />
                  </div>

                  {/* — Watch zone — */}
                  <div style={{ padding: "22px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.05)}`, borderBottom: isMobile ? `1px solid ${C(0.05)}` : "none", background: "rgba(245,158,11,0.018)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(251,191,36,0.55)", marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24", flexShrink: 0 }} />Watch
                    </div>
                    <CustomFieldInline label="ROI floor" value={customValues.watchLow} unit="%" labelColor="rgba(251,191,36,0.45)" borderColor="rgba(251,191,36,0.18)" min={-100} max={-1} onChange={v => updateCustom("watchLow", v)} />
                  </div>

                  {/* — Scale zone — */}
                  <div style={{ padding: "22px 28px 24px", background: "rgba(16,185,129,0.022)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(52,211,153,0.55)", marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />Scale
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      <CustomFieldInline label="ROI trigger"   value={customValues.scaleRoi} unit="%" labelColor="rgba(52,211,153,0.45)" borderColor="rgba(52,211,153,0.18)" min={1} max={500} onChange={v => updateCustom("scaleRoi", v)} />
                      <CustomFieldInline label="Bid increment" value={customValues.scaleInc} unit="%" labelColor="rgba(52,211,153,0.45)" borderColor="rgba(52,211,153,0.18)" min={1} max={200} onChange={v => updateCustom("scaleInc", v)} />
                    </div>
                  </div>
                </div>

                {/* ── Toggle Advanced ─────────────────────────────────── */}
                <button
                  onClick={() => setShowCustomAdvanced(v => !v)}
                  style={{
                    width: "100%", padding: "13px 28px",
                    borderTop: `1px solid ${C(0.07)}`,
                    background: showCustomAdvanced ? "rgba(139,92,246,0.07)" : "rgba(255,255,255,0.025)",
                    border: "none", borderRadius: 0,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "background 0.18s",
                  }}
                  onMouseEnter={e => { if (!showCustomAdvanced) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!showCustomAdvanced) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.025)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 7,
                      background: showCustomAdvanced ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.06)",
                      border: showCustomAdvanced ? "1px solid rgba(139,92,246,0.30)" : `1px solid ${C(0.10)}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.18s",
                    }}>
                      <motion.div
                        animate={{ rotate: showCustomAdvanced ? 180 : 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        style={{ display: "flex" }}
                      >
                        <ChevronDown size={12} color={showCustomAdvanced ? "rgba(196,181,253,0.9)" : C(0.45)} />
                      </motion.div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
                      color: showCustomAdvanced ? "rgba(196,181,253,0.80)" : C(0.50),
                      transition: "color 0.18s",
                    }}>
                      Paramètres avancés
                    </span>
                    <span style={{ fontSize: 11, color: C(0.25) }}>
                      — timings, cooldowns, limites journalières
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
                    textTransform: "uppercase" as const,
                    color: showCustomAdvanced ? "rgba(196,181,253,0.50)" : C(0.22),
                    transition: "color 0.18s",
                  }}>
                    {showCustomAdvanced ? "Réduire" : "8 champs"}
                  </span>
                </button>

                {/* ── Advanced panel (collapsible) ─────────────────────── */}
                <AnimatePresence>
                  {showCustomAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr" }}>

                        {/* Kill advanced */}
                        <div style={{ padding: "20px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.06)}`, borderBottom: isMobile ? `1px solid ${C(0.06)}` : "none", background: "rgba(244,63,94,0.05)", borderTop: "2px solid rgba(248,113,113,0.25)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase" as const, color: "rgba(248,113,113,0.50)", marginBottom: 18 }}>Kill — timings</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <CustomFieldInline label="Hold time"  value={customValues.killHold}  unit="min" labelColor="rgba(248,113,113,0.55)" borderColor="rgba(248,113,113,0.28)" min={1}  max={360} onChange={v => updateCustom("killHold", v)} />
                            <CustomFieldInline label="Cooldown"   value={customValues.killCd}    unit="h"   labelColor="rgba(248,113,113,0.55)" borderColor="rgba(248,113,113,0.28)" min={0}  max={168} onChange={v => updateCustom("killCd", v)} />
                            <CustomFieldInline label="Max / day"  value={customValues.maxKills}  unit=""    labelColor="rgba(248,113,113,0.55)" borderColor="rgba(248,113,113,0.28)" min={1}  max={100} onChange={v => updateCustom("maxKills", v)} />
                          </div>
                        </div>

                        {/* Safety (centre) */}
                        <div style={{ padding: "20px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.06)}`, borderBottom: isMobile ? `1px solid ${C(0.06)}` : "none", background: `${C(0.03)}`, borderTop: `2px solid ${C(0.10)}` }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase" as const, color: C(0.30), marginBottom: 18 }}>Safety</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <CustomFieldInline label="Min spend"       value={customValues.minSpend} unit="€" unitBefore labelColor={C(0.45)} borderColor={C(0.18)} min={0} max={9999} onChange={v => updateCustom("minSpend", v)} />
                            <CustomFieldInline label="Min conversions" value={customValues.minConv}  unit=""           labelColor={C(0.45)} borderColor={C(0.18)} min={0} max={999}  onChange={v => updateCustom("minConv", v)} />
                          </div>
                        </div>

                        {/* Scale advanced */}
                        <div style={{ padding: "20px 28px 24px", background: "rgba(16,185,129,0.05)", borderTop: "2px solid rgba(52,211,153,0.22)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase" as const, color: "rgba(52,211,153,0.50)", marginBottom: 18 }}>Scale — timings</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                            <CustomFieldInline label="Hold time"  value={customValues.scaleHold} unit="min" labelColor="rgba(52,211,153,0.55)" borderColor="rgba(52,211,153,0.25)" min={1}  max={360} onChange={v => updateCustom("scaleHold", v)} />
                            <CustomFieldInline label="Cooldown"   value={customValues.scaleCd}   unit="h"   labelColor="rgba(52,211,153,0.55)" borderColor="rgba(52,211,153,0.25)" min={0}  max={168} onChange={v => updateCustom("scaleCd", v)} />
                            <CustomFieldInline label="Max / day"  value={customValues.maxScales} unit=""    labelColor="rgba(52,211,153,0.55)" borderColor="rgba(52,211,153,0.25)" min={1}  max={100} onChange={v => updateCustom("maxScales", v)} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 4. Engine preview ─────────────────────────────────────── */}
          <motion.div key={`preview-mode-${engineMode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: EASE }} style={{
            borderRadius: 18,
            border:       engineMode === "automatic" ? "1px solid rgba(52,211,153,0.12)" : "1px solid rgba(139,92,246,0.12)",
            background:   engineMode === "automatic" ? "rgba(16,185,129,0.025)" : "rgba(139,92,246,0.025)",
            overflow:     "hidden",
          }}>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C(0.05)}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <ColLabel style={{ color: engineMode === "automatic" ? "rgba(167,243,208,0.55)" : "rgba(196,181,253,0.55)" }}>
                {engineMode === "automatic" ? "What the engine will execute" : "What the engine would suggest"}
              </ColLabel>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: engineMode === "automatic" ? "rgba(167,243,208,0.40)" : "rgba(196,181,253,0.40)" }}>
                {engineMode === "automatic" ? "Real execution" : "Dry-run · No action taken"}
              </span>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  tone: TONE.rose,
                  text: engineMode === "automatic" ? (
                    <>If ROI stays below <strong style={{ color: TONE.rose.text }}>{p.kill}%</strong> for <strong style={{ color: C(0.88) }}>{p.killHold} min</strong> and spend is above <strong style={{ color: C(0.88) }}>€{p.minSpend}</strong>, the engine will <strong style={{ color: C(0.92) }}>pause the campaign</strong>.</>
                  ) : (
                    <>If ROI stays below <strong style={{ color: TONE.rose.text }}>{p.kill}%</strong> for <strong style={{ color: C(0.88) }}>{p.killHold} min</strong> and spend is above <strong style={{ color: C(0.88) }}>€{p.minSpend}</strong>, the engine would <strong style={{ color: C(0.92) }}>suggest pausing this campaign</strong>. <span style={{ color: C(0.36) }}>No pause will happen automatically.</span></>
                  ),
                },
                {
                  tone: TONE.amber,
                  text: <>
                    If ROI stays between <strong style={{ color: TONE.amber.text }}>{p.watchLow}%</strong> and <strong style={{ color: TONE.amber.text }}>0%</strong>, the engine will <strong style={{ color: C(0.92) }}>flag the campaign for manual review</strong>. <span style={{ color: C(0.36) }}>Signal only — no automatic action in either mode.</span>
                  </>,
                },
                {
                  tone: TONE.emerald,
                  text: engineMode === "automatic" ? (
                    <>If ROI stays above <strong style={{ color: TONE.emerald.text }}>+{p.scaleRoi}%</strong>, spend is above <strong style={{ color: C(0.88) }}>€{p.minSpend * 2.5}</strong>, and conversions are at least <strong style={{ color: C(0.88) }}>{p.minConv}</strong>, the engine will <strong style={{ color: C(0.92) }}>increase the bid by +{p.scaleInc}%</strong>.</>
                  ) : (
                    <>If ROI stays above <strong style={{ color: TONE.emerald.text }}>+{p.scaleRoi}%</strong>, spend is above <strong style={{ color: C(0.88) }}>€{p.minSpend * 2.5}</strong>, and conversions are at least <strong style={{ color: C(0.88) }}>{p.minConv}</strong>, the engine would <strong style={{ color: C(0.92) }}>suggest increasing the bid by +{p.scaleInc}%</strong>. <span style={{ color: C(0.36) }}>No bid change will happen automatically.</span></>
                  ),
                },
              ].map((row, i) => (
                <motion.div key={`preview-${i}-${key}-${engineMode}`} {...s(i)} style={{
                  borderRadius: 11,
                  border:       row.tone.border,
                  background:   row.tone.bg,
                  padding:      "11px 14px",
                  fontSize:     13,
                  lineHeight:   1.75,
                  color:        C(0.72),
                }}>
                  {row.text}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── F. Recent engine actions ──────────────────────────────── */}
          <div style={{
            borderRadius: 18,
            border:       `1px solid ${C(0.08)}`,
            overflow:     "hidden",
            background:   C(0.015),
          }}>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C(0.06)}` }}>
              <ColLabel>Recent engine actions</ColLabel>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              {actions.length === 0 && (
                <div style={{ padding: "14px 6px", fontSize: 12, color: C(0.28), textAlign: "center" }}>
                  No engine actions yet
                </div>
              )}
              {actions.slice(0, 5).map((r, i) => {
                const t = TONE[r.r];
                return (
                  <div key={i} style={{
                    borderRadius: 11,
                    border:       t.border,
                    background:   t.bg,
                    padding:      "10px 14px",
                    display:      "flex",
                    alignItems:   "flex-start",
                    gap:          12,
                  }}>
                    <div style={{ flexShrink: 0, marginTop: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
                        textTransform: "uppercase", color: t.text,
                        border: `1px solid ${t.border}`,
                        background: t.bg,
                        padding: "3px 8px", borderRadius: 6,
                      }}>{r.type}</span>
                      {r.isRecommend && (
                        <span style={{
                          fontSize: 8, fontWeight: 600, letterSpacing: "0.12em",
                          textTransform: "uppercase", color: "rgba(196,181,253,0.55)",
                        }}>suggestion</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C(0.86), fontWeight: 500 }}>{r.camp}</div>
                      <div style={{ fontSize: 11, color: C(0.40), marginTop: 2 }}>{r.ctx}</div>
                    </div>
                    <span style={{ fontSize: 11, color: C(0.26), whiteSpace: "nowrap", flexShrink: 0 }}>{r.date}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── H. Emergency Stop ─────────────────────────────────────── */}
          <motion.div {...s(6)} style={{
            borderRadius: 18,
            border:       engPaused ? "1px solid rgba(251,191,36,0.28)" : `1px solid ${C(0.07)}`,
            background:   engPaused ? "rgba(245,158,11,0.04)" : C(0.015),
            padding:      "20px 24px",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            gap:          20,
            flexWrap:     "wrap" as const,
            transition:   "all 0.3s ease",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                {engPaused
                  ? <ShieldOff size={14} color="rgba(253,230,138,0.80)" />
                  : <Shield    size={14} color={C(0.38)} />
                }
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: engPaused ? "rgba(253,230,138,0.90)" : C(0.78),
                }}>
                  {engPaused ? "Automation paused" : "Emergency stop"}
                </span>
              </div>
              <p style={{
                fontSize: 12, color: engPaused ? "rgba(251,191,36,0.55)" : C(0.35),
                margin: 0, lineHeight: 1.6, maxWidth: 520,
              }}>
                {engPaused
                  ? `All automatic actions are suspended until ${fmtPausedUntil(pausedUntil)}. Watch signals remain active.`
                  : "Suspend all automatic Kill and Scale actions globally for 24 hours. Watch signals will still be raised. No campaigns will be paused or scaled by the engine."}
              </p>
            </div>
            <button
              onClick={handleEmergencyStop}
              disabled={pauseLoading}
              style={{
                height:       40,
                padding:      "0 20px",
                borderRadius: 12,
                border:       engPaused
                  ? "1px solid rgba(251,191,36,0.30)"
                  : "1px solid rgba(248,113,113,0.28)",
                background:   engPaused
                  ? "rgba(245,158,11,0.10)"
                  : "rgba(244,63,94,0.08)",
                color:        engPaused ? "rgba(253,230,138,0.85)" : "#fca5a5",
                fontSize:     12,
                fontWeight:   600,
                cursor:       pauseLoading ? "default" : "pointer",
                opacity:      pauseLoading ? 0.5 : 1,
                display:      "flex",
                alignItems:   "center",
                gap:          7,
                whiteSpace:   "nowrap" as const,
                transition:   "all 0.25s ease",
                flexShrink:   0,
              }}
            >
              {engPaused
                ? <><Shield size={13} />Resume automation</>
                : <><ShieldOff size={13} />Pause all automation</>
              }
            </button>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
