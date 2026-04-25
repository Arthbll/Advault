"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, CheckCircle2, Zap, BookOpen, ShieldOff, Shield, Play,
  AlertCircle, RefreshCw, Power, ChevronDown, Lock, TrendingUp, Link2,
  Eye, XCircle, ArrowUpCircle,
} from "lucide-react";
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
  description: string;
  kill: number;  watchLow: number;
  scaleRoi: number; scaleInc: number;
  minSpend: number; minConv: number;
  killHold: number; scaleHold: number;
  killCd: number; scaleCd: number;
  maxKills: number; maxScales: number;
}
const PRESETS: Record<PresetKey, Preset> = {
  soft: {
    label: "Prudent",
    description: "Attend longtemps avant d'agir. Idéal si vous débutez.",
    kill: -35, watchLow: -20, scaleRoi: 35, scaleInc: 5,
    minSpend: 30, minConv: 4, killHold: 45, scaleHold: 90,
    killCd: 4, scaleCd: 8, maxKills: 3, maxScales: 1,
  },
  balanced: {
    label: "Équilibré",
    description: "Le bon compromis pour la plupart des annonceurs.",
    kill: -30, watchLow: -15, scaleRoi: 30, scaleInc: 10,
    minSpend: 20, minConv: 3, killHold: 30, scaleHold: 60,
    killCd: 3, scaleCd: 6, maxKills: 5, maxScales: 2,
  },
  aggressive: {
    label: "Agressif",
    description: "Réagit vite. Pour les utilisateurs expérimentés.",
    kill: -20, watchLow: -10, scaleRoi: 20, scaleInc: 20,
    minSpend: 25, minConv: 2, killHold: 25, scaleHold: 45,
    killCd: 2, scaleCd: 4, maxKills: 8, maxScales: 4,
  },
  custom: {
    label: "Personnalisé",
    description: "Vous définissez vos propres seuils.",
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

function ColLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.20em", color: C(0.22), ...style }}>
      {children}
    </div>
  );
}

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
        Automatique
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", color: "rgba(196,181,253,0.80)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: "#a78bfa" }} />
      Suggestion
    </span>
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
  const [actions,       setActions]       = useState<ActionRow[]>([]);
  const [engineMode,    setEngineMode]    = useState<"automatic" | "recommendation">("recommendation");
  const [engPaused,     setEngPaused]     = useState(false);
  const [pausedUntil,   setPausedUntil]   = useState<string | null>(null);
  const [pauseLoading,  setPauseLoading]  = useState(false);
  const [killEnabled,   setKillEnabled]   = useState(false);
  const [spendOnly,     setSpendOnly]     = useState(false);
  const [maxSpend,      setMaxSpend]      = useState<number | null>(null);
  const [timeWindowEnabled, setTimeWindowEnabled] = useState(false);
  const [timeWindowStart,  setTimeWindowStart]  = useState<number>(8);
  const [timeWindowEnd,    setTimeWindowEnd]    = useState<number>(22);
  const [customValues,  setCustomValues]  = useState<Preset>({ ...PRESETS.balanced, label: "Personnalisé", description: "Vous définissez vos propres seuils." });
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
  const [hasRevenue,     setHasRevenue]     = useState<boolean | null>(null);
  useEffect(() => setMounted(true), []);
  const p = key === "custom" ? customValues : PRESETS[key];

  // ── Load saved config on mount ────────────────────────────────────────────
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
        if (d.preset === "custom" && d.killRoi != null) {
          setCustomValues({
            label: "Personnalisé",
            description: "Vous définissez vos propres seuils.",
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
      .catch(() => {});

    fetch("/api/engine/emergency-stop")
      .then(r => r.json())
      .then((d: { paused?: boolean; pausedUntil?: string | null }) => {
        setEngPaused(d.paused ?? false);
        setPausedUntil(d.pausedUntil ?? null);
      })
      .catch(() => {});

    fetch("/api/revenue/signal")
      .then(r => r.json())
      .then((d: { hasRevenue?: boolean }) => setHasRevenue(d.hasRevenue ?? false))
      .catch(() => setHasRevenue(false));
  }, []);

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
      })
      .catch(() => {});
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          killSwitchEnabled:   killEnabled,
          spendOnlyMode:       spendOnly,
          maxSpendPerCampaign: maxSpend,
          roiThreshold:        p.kill,
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
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

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
           " le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
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

  const LINE = "rgba(255,255,255,0.08)";

  function SCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 22, padding: 20, background: "rgba(255,255,255,0.02)", ...style }}>
        {children}
      </div>
    );
  }

  function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
    return (
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: color ?? C(0.30), marginBottom: 12 }}>
        {children}
      </div>
    );
  }

  const safetyRows: [string, string][] = [
    ["Dépense min avant décision", `€${p.minSpend}`],
    ["Conversions min avant scale", String(p.minConv)],
    ["Attente avant kill",          `${p.killHold} min`],
    ["Attente avant scale",         `${p.scaleHold} min`],
    ["Cooldown kill",               `${p.killCd}h`],
    ["Cooldown scale",              `${p.scaleCd}h`],
    ["Kills max / jour",            String(p.maxKills)],
    ["Scales max / jour",           String(p.maxScales)],
    ["Incrément de bid",            `+${p.scaleInc}%`],
  ];

  return (
    <div style={{ padding: isMobile ? "16px 12px 80px" : "28px 28px 64px", maxWidth: 1500, margin: "0 auto" }}>

      {/* ── Mode transition toast ─────────────────────────────────────────────── */}
      {mounted && createPortal(
        <AnimatePresence>
          {overlayVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
            >
              <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(4px)", background: "rgba(4,5,10,0.52)" }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
                style={{
                  position: "relative", borderRadius: 32,
                  border: overlayMode === "automatic" ? "1px solid rgba(52,211,153,0.22)" : "1px solid rgba(139,92,246,0.24)",
                  background: "linear-gradient(180deg,rgba(13,15,24,0.96),rgba(8,10,17,0.96))",
                  padding: isMobile ? "24px 20px" : "44px 64px",
                  textAlign: "center", backdropFilter: "blur(32px)",
                  boxShadow: "0 40px 100px rgba(0,0,0,0.65)",
                  minWidth: isMobile ? "calc(100vw - 32px)" : 460,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.28em", marginBottom: 18, color: overlayMode === "automatic" ? "rgba(110,231,183,0.60)" : "rgba(167,139,250,0.60)" }}>
                  Mode du moteur
                </div>
                <div style={{ fontSize: isMobile ? 36 : 56, fontWeight: 200, letterSpacing: "-0.07em", lineHeight: 1, color: overlayMode === "automatic" ? "rgba(167,243,208,0.96)" : "rgba(196,181,253,0.96)" }}>
                  {overlayMode === "automatic" ? "Automatique" : "Suggestions"}
                </div>
                <div style={{ marginTop: 16, fontSize: 14, color: C(0.40), letterSpacing: "-0.01em" }}>
                  {overlayMode === "automatic"
                    ? "Le robot agit seul — il pause et scale vos campagnes"
                    : "Le robot suggère seulement — vous gardez le contrôle"}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Outer card ───────────────────────────────────────────────────────── */}
      <motion.div {...s(0)} style={{
        borderRadius: 28, border: `1px solid ${C(0.08)}`, overflow: "hidden",
        background: "linear-gradient(180deg,rgba(11,12,18,0.98),rgba(7,8,12,0.99))",
        boxShadow: "0 32px 100px rgba(0,0,0,0.38)",
      }}>

        {/* ── A. Header ────────────────────────────────────────────────────── */}
        <div style={{
          padding: "28px 32px",
          borderBottom: `1px solid ${C(0.06)}`,
          background: "radial-gradient(circle at 16% 0%,rgba(99,102,241,0.08),transparent 28%),radial-gradient(circle at 84% 0%,rgba(16,185,129,0.06),transparent 22%)",
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          gap: isMobile ? 8 : 24, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.22) }}>
              Règles de décision
            </div>
            <h1 style={{ margin: "10px 0 4px", fontSize: isMobile ? 22 : 32, fontWeight: 300, letterSpacing: "-0.05em", lineHeight: 1.15, color: C(0.92) }}>
              Le robot qui surveille vos campagnes 24h/24.
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: C(0.40), letterSpacing: "-0.01em" }}>
              Configurez ce qu&apos;il fait quand une campagne perd ou gagne de l&apos;argent.
            </p>
          </div>

          {/* Right: Run Scan + Save */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* Run scan */}
            <button
              onClick={handleRunScan}
              disabled={scanning}
              style={{
                height: 40, padding: "0 16px", borderRadius: 12,
                border: scanError
                  ? "1px solid rgba(251,113,133,0.30)"
                  : scanResult
                    ? "1px solid rgba(52,211,153,0.30)"
                    : "1px solid rgba(255,255,255,0.10)",
                background: scanError
                  ? "rgba(244,63,94,0.08)"
                  : scanResult ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.04)",
                color: scanError ? "#fca5a5" : scanResult ? "rgba(167,243,208,0.95)" : C(0.55),
                fontSize: 12, fontWeight: 600,
                cursor: scanning ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 7,
                opacity: scanning ? 0.6 : 1,
                transition: "all 0.22s ease", whiteSpace: "nowrap" as const,
              }}
            >
              {scanError ? (
                <><AlertCircle size={13} />Erreur</>
              ) : scanning ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} style={{ display: "flex" }}>
                    <RefreshCw size={13} />
                  </motion.div>
                  Analyse…
                </>
              ) : scanResult ? (
                <>
                  <CheckCircle2 size={13} />
                  {engineMode === "automatic"
                    ? `${scanResult.checked} vérifiées · ${scanResult.killed} pausées · ${scanResult.scaled} scalées`
                    : `${scanResult.checked} vérifiées · ${scanResult.killed} suggestions`}
                </>
              ) : (
                <>
                  <Play size={11} />
                  {engineMode === "automatic" ? "Lancer un scan" : "Prévisualiser"}
                </>
              )}
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                height: 40, padding: "0 18px", borderRadius: 12, border: "none",
                background: saved
                  ? "linear-gradient(90deg,#10b981,#059669)"
                  : "linear-gradient(90deg,#8b5cf6,#7c3aed)",
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: saving ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 7,
                opacity: saving ? 0.65 : 1,
                boxShadow: saved ? "none" : "0 4px 18px rgba(139,92,246,0.24)",
                transition: "background 0.3s ease, opacity 0.2s ease",
                whiteSpace: "nowrap" as const,
              }}
            >
              {saved ? <><CheckCircle2 size={14} />Sauvegardé</> : <><Save size={14} />{saving ? "Sauvegarde…" : "Sauvegarder"}</>}
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── 1. How it works — 3 actions explained ────────────────────── */}
          <motion.div {...s(1)}>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C(0.55) }}>
                Ce que le robot peut faire
              </div>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, ${LINE}, transparent)` }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
              {[
                {
                  icon: <XCircle size={18} color="#f87171" strokeWidth={1.5} />,
                  label: "Pause (Kill)",
                  color: "#f87171",
                  bg: "rgba(244,63,94,0.04)",
                  border: "rgba(248,113,113,0.14)",
                  title: "Stoppe une campagne qui perd de l'argent",
                  desc: "Si une campagne dépense sans rapporter, le robot la met en pause automatiquement — avant que les pertes ne s'accumulent.",
                },
                {
                  icon: <Eye size={18} color="#fbbf24" strokeWidth={1.5} />,
                  label: "Surveillance (Watch)",
                  color: "#fbbf24",
                  bg: "rgba(245,158,11,0.04)",
                  border: "rgba(251,191,36,0.14)",
                  title: "Signale une campagne à surveiller",
                  desc: "Si une campagne n'est pas rentable mais pas encore en perte critique, le robot vous alerte pour que vous jetiez un œil.",
                },
                {
                  icon: <ArrowUpCircle size={18} color="#34d399" strokeWidth={1.5} />,
                  label: "Montée en puissance (Scale)",
                  color: "#34d399",
                  bg: "rgba(16,185,129,0.04)",
                  border: "rgba(52,211,153,0.14)",
                  title: "Augmente le budget d'une campagne gagnante",
                  desc: "Si une campagne est très rentable, le robot augmente son enchère automatiquement pour profiter au maximum de son succès.",
                },
              ].map((item) => (
                <div key={item.label} style={{
                  borderRadius: 16,
                  border: `1px solid ${item.border}`,
                  background: item.bg,
                  padding: "16px 18px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    {item.icon}
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
                      textTransform: "uppercase" as const, color: item.color,
                    }}>
                      {item.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C(0.80), marginBottom: 6, letterSpacing: "-0.01em" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: C(0.38), lineHeight: 1.65 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── 2. Engine ON/OFF + Mode selection ────────────────────────── */}
          <motion.div {...s(2)}>
            <SCard style={{
              border: killEnabled
                ? "1px solid rgba(74,222,128,0.22)"
                : `1px solid ${LINE}`,
              background: killEnabled
                ? "linear-gradient(180deg,rgba(74,222,128,0.05),rgba(74,222,128,0.01))"
                : "rgba(255,255,255,0.02)",
              transition: "all 0.3s ease",
            }}>
              {/* Title + toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: killEnabled ? "rgba(134,239,172,0.90)" : C(0.75), marginBottom: 4, letterSpacing: "-0.01em" }}>
                    {killEnabled ? "Le moteur est actif" : "Le moteur est éteint"}
                  </div>
                  <div style={{ fontSize: 12, color: C(0.38), lineHeight: 1.55, maxWidth: 480 }}>
                    {killEnabled
                      ? "ProfitDash surveille vos campagnes en ce moment même. Il agit selon le mode choisi ci-dessous."
                      : "Aucune action automatique ne sera prise. Activez le moteur pour que ProfitDash commence à surveiller vos campagnes."}
                  </div>
                </div>
                <button
                  onClick={() => setKillEnabled(v => !v)}
                  style={{
                    height: 44, padding: "0 20px", borderRadius: 14,
                    border: killEnabled
                      ? "1px solid rgba(74,222,128,0.30)"
                      : "1px solid rgba(255,255,255,0.14)",
                    background: killEnabled
                      ? "rgba(74,222,128,0.12)"
                      : "rgba(255,255,255,0.06)",
                    color: killEnabled ? "#86efac" : C(0.65),
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.22s ease",
                    display: "flex", alignItems: "center", gap: 8,
                    whiteSpace: "nowrap" as const, flexShrink: 0,
                  }}
                >
                  <Power size={14} strokeWidth={2} />
                  {killEnabled ? "Désactiver" : "Activer le moteur"}
                </button>
              </div>

              {/* Mode selection — only shown when engine is ON */}
              <AnimatePresence>
                {killEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ borderTop: `1px solid rgba(255,255,255,0.06)`, paddingTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C(0.40), marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.14em" }}>
                        Comment le robot doit-il agir ?
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                        {/* Recommendation mode */}
                        <button
                          onClick={() => handleModeSwitch("recommendation")}
                          style={{
                            borderRadius: 16,
                            border: engineMode === "recommendation"
                              ? "1px solid rgba(139,92,246,0.35)"
                              : `1px solid ${LINE}`,
                            background: engineMode === "recommendation"
                              ? "rgba(139,92,246,0.10)"
                              : "rgba(255,255,255,0.02)",
                            padding: "16px 18px", cursor: "pointer",
                            textAlign: "left" as const,
                            transition: "all 0.22s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <BookOpen size={14} color={engineMode === "recommendation" ? "rgba(196,181,253,0.90)" : C(0.40)} strokeWidth={1.5} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: engineMode === "recommendation" ? "rgba(196,181,253,0.95)" : C(0.70) }}>
                              Mode suggestions
                            </span>
                            {engineMode === "recommendation" && (
                              <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: C(0.38), lineHeight: 1.6 }}>
                            Le robot <strong style={{ color: C(0.60) }}>vous dit ce qu&apos;il ferait</strong>, mais n&apos;agit pas. Vous restez maître de chaque décision. Idéal pour commencer.
                          </div>
                        </button>

                        {/* Automatic mode */}
                        <button
                          onClick={() => !canUseAutomatic ? null : handleModeSwitch("automatic")}
                          title={!canUseAutomatic ? `Mode automatique — disponible avec Dominion. ${currentPlan.upgradeLabel}` : undefined}
                          style={{
                            borderRadius: 16,
                            border: engineMode === "automatic"
                              ? "1px solid rgba(74,222,128,0.35)"
                              : `1px solid ${LINE}`,
                            background: engineMode === "automatic"
                              ? "rgba(74,222,128,0.08)"
                              : "rgba(255,255,255,0.02)",
                            padding: "16px 18px",
                            cursor: !canUseAutomatic ? "not-allowed" : "pointer",
                            textAlign: "left" as const,
                            transition: "all 0.22s ease",
                            opacity: !canUseAutomatic ? 0.6 : 1,
                            position: "relative" as const,
                          }}
                        >
                          {!canUseAutomatic && (
                            <Link
                              href="/dashboard/settings?tab=plan"
                              onClick={e => e.stopPropagation()}
                              style={{
                                position: "absolute", top: 10, right: 10,
                                display: "flex", alignItems: "center", gap: 3,
                                padding: "2px 7px", borderRadius: 99,
                                background: "rgba(139,92,246,0.12)",
                                border: "1px solid rgba(139,92,246,0.25)",
                                fontSize: 9, fontWeight: 700, color: "rgba(196,181,253,0.9)",
                                textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" as const,
                                whiteSpace: "nowrap" as const,
                              }}
                            >
                              <Lock size={7} strokeWidth={2.5} /> Dominion
                            </Link>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <Zap size={14} color={engineMode === "automatic" ? "rgba(134,239,172,0.90)" : C(0.40)} strokeWidth={1.5} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: engineMode === "automatic" ? "rgba(134,239,172,0.95)" : C(0.70) }}>
                              Mode automatique
                            </span>
                            {engineMode === "automatic" && (
                              <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#6ee7b7", flexShrink: 0 }} />
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: C(0.38), lineHeight: 1.6 }}>
                            Le robot <strong style={{ color: C(0.60) }}>agit seul</strong> — il pause et scale vos campagnes sans vous demander. Vérifiez les résultats dans l&apos;historique.
                          </div>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SCard>
          </motion.div>

          {/* ── 3. Budget Protection + Profit Engine ──────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>

            {/* ── Budget Protection ──────────────────────────────────────── */}
            <motion.div {...s(3)}>
              <SCard style={{
                background: "linear-gradient(180deg,rgba(251,191,36,0.05),rgba(251,191,36,0.01))",
                border: "1px solid rgba(251,191,36,0.16)",
                height: "100%", display: "flex", flexDirection: "column" as const, gap: 16,
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Shield size={14} color="rgba(251,191,36,0.70)" strokeWidth={1.5} />
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(251,191,36,0.65)" }}>
                      Protection du budget
                    </span>
                    <span style={{
                      marginLeft: "auto", fontSize: 10, fontWeight: 700,
                      padding: "2px 8px", borderRadius: 99,
                      background: "rgba(251,191,36,0.10)",
                      border: "1px solid rgba(251,191,36,0.22)",
                      color: "rgba(253,230,138,0.80)",
                      letterSpacing: "0.10em", textTransform: "uppercase" as const,
                    }}>Toujours actif</span>
                  </div>
                  <div style={{ fontSize: 12, color: C(0.38), lineHeight: 1.6 }}>
                    Protège votre budget <strong style={{ color: C(0.55) }}>même sans signal de revenu</strong>. Fonctionne dès que vous lancez une campagne.
                  </div>
                </div>

                {/* Max spend cap */}
                <div style={{ borderRadius: 13, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.02)", padding: "12px 15px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.16em", color: C(0.28), marginBottom: 8 }}>
                    Dépense max par campagne
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: C(0.40) }}>€</span>
                    <input
                      type="number" min={0} step={1} value={maxSpend ?? ""} placeholder="Sans limite"
                      onChange={e => { const v = e.target.value; setMaxSpend(v === "" ? null : Number(v)); }}
                      style={{
                        width: 110, padding: "6px 10px", borderRadius: 8, fontSize: 13,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: C(0.85), outline: "none", colorScheme: "dark" as const,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: C(0.28), marginTop: 6 }}>
                    Si une campagne dépasse cette limite, elle sera mise en pause automatiquement.
                  </div>
                </div>

                {/* Spend-only toggle */}
                <div style={{
                  borderRadius: 13,
                  border: spendOnly ? "1px solid rgba(251,191,36,0.18)" : `1px solid ${LINE}`,
                  background: spendOnly ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                  padding: "13px 15px", transition: "all 0.25s ease",
                  display: "flex", alignItems: "flex-start", gap: 12,
                }}>
                  <button onClick={() => setSpendOnly(v => !v)} style={{
                    flexShrink: 0, width: 38, height: 20, borderRadius: 99, marginTop: 1,
                    background: spendOnly ? "#fbbf24" : "rgba(255,255,255,0.10)",
                    border: "none", cursor: "pointer", position: "relative" as const,
                    transition: "background 0.22s",
                  }}>
                    <motion.div
                      animate={{ left: spendOnly ? 19 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      style={{ position: "absolute" as const, top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
                    />
                  </button>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: spendOnly ? "rgba(253,230,138,0.90)" : C(0.70), marginBottom: 3 }}>
                      Mode dépense uniquement
                    </div>
                    <div style={{ fontSize: 11, color: C(0.30), lineHeight: 1.5 }}>
                      Active si votre réseau publicitaire ne fournit pas de données de conversion. Le robot se base uniquement sur le budget dépensé.
                    </div>
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
                        style={{ position: "absolute" as const, top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
                      />
                    </button>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: timeWindowEnabled ? "rgba(165,180,252,0.90)" : C(0.70) }}>
                        Horaires d&apos;activité
                      </div>
                      {!timeWindowEnabled && (
                        <div style={{ fontSize: 11, color: C(0.30) }}>Le moteur tourne 24h/24 par défaut</div>
                      )}
                    </div>
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
              </SCard>
            </motion.div>

            {/* ── Profit Engine ──────────────────────────────────────────── */}
            <motion.div {...s(4)}>
              <SCard style={{
                background: hasRevenue
                  ? "linear-gradient(180deg,rgba(52,211,153,0.05),rgba(52,211,153,0.01))"
                  : "rgba(255,255,255,0.02)",
                border: hasRevenue
                  ? "1px solid rgba(52,211,153,0.20)"
                  : `1px solid ${LINE}`,
                height: "100%", display: "flex", flexDirection: "column" as const, gap: 16,
              }}>
                {/* Header */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <TrendingUp size={14} color={hasRevenue ? "rgba(52,211,153,0.70)" : C(0.25)} strokeWidth={1.5} />
                    <span style={{
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.14em",
                      textTransform: "uppercase" as const,
                      color: hasRevenue ? "rgba(52,211,153,0.65)" : C(0.28),
                    }}>
                      Moteur de profit
                    </span>
                    {!hasRevenue && (
                      <span style={{
                        marginLeft: "auto", fontSize: 10, fontWeight: 700,
                        padding: "2px 8px", borderRadius: 99,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${LINE}`,
                        color: C(0.35),
                        letterSpacing: "0.10em", textTransform: "uppercase" as const,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Lock size={9} /> Verrouillé
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C(0.38), lineHeight: 1.6 }}>
                    {hasRevenue
                      ? "Vos données de conversion sont connectées. Le robot peut décider en fonction du ROI réel."
                      : <><strong style={{ color: C(0.55) }}>Nécessite un signal de revenu.</strong> Connectez votre postback pour que le robot puisse mesurer la rentabilité de chaque campagne et prendre des décisions basées sur le ROI.</>}
                  </div>
                </div>

                {!hasRevenue ? (
                  /* ── Locked state ── */
                  <div style={{
                    flex: 1, borderRadius: 16,
                    border: "1px solid rgba(14,165,233,0.18)",
                    background: "rgba(14,165,233,0.04)",
                    padding: "20px 18px",
                    display: "flex", flexDirection: "column" as const, gap: 14,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(125,211,252,0.85)", marginBottom: 8 }}>
                        Comment l&apos;activer ?
                      </div>
                      {[
                        { n: "1", text: "Allez dans Paramètres → Postbacks" },
                        { n: "2", text: "Copiez l'URL de postback ProfitDash" },
                        { n: "3", text: "Collez-la dans votre réseau d'affiliation" },
                        { n: "4", text: "Revenez ici — le moteur de profit s'activera automatiquement" },
                      ].map(step => (
                        <div key={step.n} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                            background: "rgba(14,165,233,0.15)",
                            border: "1px solid rgba(14,165,233,0.25)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700, color: "rgba(125,211,252,0.80)",
                          }}>{step.n}</span>
                          <span style={{ fontSize: 12, color: C(0.45), lineHeight: 1.5 }}>{step.text}</span>
                        </div>
                      ))}
                    </div>
                    <a href="/dashboard/settings?tab=postbacks" style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      fontSize: 12, fontWeight: 600,
                      color: "rgba(14,165,233,0.85)",
                      border: "1px solid rgba(14,165,233,0.22)",
                      background: "rgba(14,165,233,0.08)",
                      borderRadius: 10, padding: "9px 14px", textDecoration: "none",
                      alignSelf: "flex-start" as const,
                    }}>
                      <Link2 size={12} />
                      Configurer le postback
                    </a>
                  </div>
                ) : (
                  /* ── Active state ── */
                  <>
                    {/* Preset selection */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.16em", color: C(0.28), marginBottom: 10 }}>
                        Niveau d&apos;agressivité
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                        {(["soft", "balanced", "aggressive", "custom"] as PresetKey[]).map(k => (
                          <button key={k} onClick={() => setKey(k)} style={{
                            borderRadius: 12,
                            border: key === k ? "1px solid rgba(139,92,246,0.30)" : `1px solid ${LINE}`,
                            background: key === k ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.02)",
                            padding: "11px 14px", cursor: "pointer", textAlign: "left" as const,
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                            transition: "all 0.18s ease",
                          }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: key === k ? "rgba(196,181,253,0.95)" : C(0.75), marginBottom: 2 }}>
                                {PRESETS[k].label}
                              </div>
                              <div style={{ fontSize: 11, color: C(0.35) }}>
                                {PRESETS[k].description}
                              </div>
                            </div>
                            {key === k && (
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active rules table */}
                    <div style={{ borderRadius: 14, border: `1px solid ${LINE}`, overflow: "hidden", background: "linear-gradient(180deg,rgba(14,15,23,0.96),rgba(8,9,14,0.98))" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 80px", gap: 12, padding: "9px 14px", borderBottom: `1px solid ${LINE}` }}>
                        <ColLabel>Décision</ColLabel>
                        <ColLabel>Déclencheur</ColLabel>
                        <ColLabel>Mode</ColLabel>
                      </div>
                      {[
                        { label: "Kill",  color: "#f87171", trigger: `ROI < ${p.kill}%`,             role: "kill"  as const },
                        { label: "Watch", color: "#fbbf24", trigger: `ROI ${p.watchLow}% → 0%`,      role: "watch" as const },
                        { label: "Scale", color: "#34d399", trigger: `ROI > +${p.scaleRoi}%`,         role: "scale" as const },
                      ].map((row, i) => {
                        const toneArr = [TONE.rose, TONE.amber, TONE.emerald];
                        const t = toneArr[i];
                        return (
                          <div key={row.label} style={{
                            display: "grid", gridTemplateColumns: "90px 1fr 80px", gap: 12,
                            padding: "13px 14px", alignItems: "center",
                            borderBottom: i < 2 ? `1px solid ${LINE}` : "none",
                            background: t.rowBg,
                          }}>
                            <DecisionBadge label={row.label} color={row.color} />
                            <div style={{ fontSize: 13, fontWeight: 300, letterSpacing: "-0.02em", color: C(0.80) }}>{row.trigger}</div>
                            <ModePill role={row.role} mode={engineMode} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </SCard>
            </motion.div>
          </div>

          {/* ── 4. Custom mode editor ─────────────────────────────────────── */}
          <AnimatePresence>
            {key === "custom" && hasRevenue && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: EASE }}
                style={{
                  borderRadius: 18, border: `1px solid ${C(0.08)}`,
                  overflow: "hidden",
                  background: "linear-gradient(180deg,rgba(14,15,23,0.96),rgba(8,9,14,0.98))",
                }}
              >
                <div style={{
                  padding: "12px 24px", borderBottom: `1px solid ${C(0.05)}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,0.015)",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: C(0.28) }}>
                    Seuils personnalisés
                  </div>
                  <div style={{ fontSize: 11, color: C(0.25) }}>
                    Modifiez directement · sauvegardé avec « Sauvegarder »
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr" }}>
                  <div style={{ padding: "22px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.05)}`, borderBottom: isMobile ? `1px solid ${C(0.05)}` : "none", background: "rgba(244,63,94,0.022)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(248,113,113,0.55)", marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />Kill
                    </div>
                    <CustomFieldInline label="Seuil ROI" value={customValues.kill} unit="%" labelColor="rgba(248,113,113,0.45)" borderColor="rgba(248,113,113,0.20)" min={-100} max={-1} onChange={v => updateCustom("kill", v)} />
                  </div>

                  <div style={{ padding: "22px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.05)}`, borderBottom: isMobile ? `1px solid ${C(0.05)}` : "none", background: "rgba(245,158,11,0.018)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(251,191,36,0.55)", marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24", flexShrink: 0 }} />Watch
                    </div>
                    <CustomFieldInline label="Seuil bas ROI" value={customValues.watchLow} unit="%" labelColor="rgba(251,191,36,0.45)" borderColor="rgba(251,191,36,0.18)" min={-100} max={-1} onChange={v => updateCustom("watchLow", v)} />
                  </div>

                  <div style={{ padding: "22px 28px 24px", background: "rgba(16,185,129,0.022)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.24em", color: "rgba(52,211,153,0.55)", marginBottom: 20, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />Scale
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 18 }}>
                      <CustomFieldInline label="Seuil ROI" value={customValues.scaleRoi} unit="%" labelColor="rgba(52,211,153,0.45)" borderColor="rgba(52,211,153,0.18)" min={1} max={500} onChange={v => updateCustom("scaleRoi", v)} />
                      <CustomFieldInline label="Incrément bid" value={customValues.scaleInc} unit="%" labelColor="rgba(52,211,153,0.45)" borderColor="rgba(52,211,153,0.18)" min={1} max={200} onChange={v => updateCustom("scaleInc", v)} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowCustomAdvanced(v => !v)}
                  style={{
                    width: "100%", padding: "13px 28px",
                    borderTop: `1px solid ${C(0.07)}`,
                    background: showCustomAdvanced ? "rgba(139,92,246,0.07)" : "rgba(255,255,255,0.025)",
                    border: "none", borderRadius: 0, cursor: "pointer",
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
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: showCustomAdvanced ? "rgba(196,181,253,0.80)" : C(0.50), transition: "color 0.18s" }}>
                      Paramètres avancés
                    </span>
                    <span style={{ fontSize: 11, color: C(0.25) }}>
                      — timings, cooldowns, limites journalières
                    </span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: showCustomAdvanced ? "rgba(196,181,253,0.50)" : C(0.22), transition: "color 0.18s" }}>
                    {showCustomAdvanced ? "Réduire" : "8 champs"}
                  </span>
                </button>

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
                        <div style={{ padding: "20px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.06)}`, borderBottom: isMobile ? `1px solid ${C(0.06)}` : "none", background: "rgba(244,63,94,0.05)", borderTop: "2px solid rgba(248,113,113,0.25)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase" as const, color: "rgba(248,113,113,0.50)", marginBottom: 18 }}>Kill — timings</div>
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
                            <CustomFieldInline label="Attente" value={customValues.killHold} unit="min" labelColor="rgba(248,113,113,0.55)" borderColor="rgba(248,113,113,0.28)" min={1} max={360} onChange={v => updateCustom("killHold", v)} />
                            <CustomFieldInline label="Cooldown" value={customValues.killCd} unit="h" labelColor="rgba(248,113,113,0.55)" borderColor="rgba(248,113,113,0.28)" min={0} max={168} onChange={v => updateCustom("killCd", v)} />
                            <CustomFieldInline label="Max / jour" value={customValues.maxKills} unit="" labelColor="rgba(248,113,113,0.55)" borderColor="rgba(248,113,113,0.28)" min={1} max={100} onChange={v => updateCustom("maxKills", v)} />
                          </div>
                        </div>

                        <div style={{ padding: "20px 28px 24px", borderRight: isMobile ? "none" : `1px solid ${C(0.06)}`, borderBottom: isMobile ? `1px solid ${C(0.06)}` : "none", background: `${C(0.03)}`, borderTop: `2px solid ${C(0.10)}` }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase" as const, color: C(0.30), marginBottom: 18 }}>Sécurité</div>
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
                            <CustomFieldInline label="Dépense min" value={customValues.minSpend} unit="€" unitBefore labelColor={C(0.45)} borderColor={C(0.18)} min={0} max={9999} onChange={v => updateCustom("minSpend", v)} />
                            <CustomFieldInline label="Conversions min" value={customValues.minConv} unit="" labelColor={C(0.45)} borderColor={C(0.18)} min={0} max={999} onChange={v => updateCustom("minConv", v)} />
                          </div>
                        </div>

                        <div style={{ padding: "20px 28px 24px", background: "rgba(16,185,129,0.05)", borderTop: "2px solid rgba(52,211,153,0.22)" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase" as const, color: "rgba(52,211,153,0.50)", marginBottom: 18 }}>Scale — timings</div>
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
                            <CustomFieldInline label="Attente" value={customValues.scaleHold} unit="min" labelColor="rgba(52,211,153,0.55)" borderColor="rgba(52,211,153,0.25)" min={1} max={360} onChange={v => updateCustom("scaleHold", v)} />
                            <CustomFieldInline label="Cooldown" value={customValues.scaleCd} unit="h" labelColor="rgba(52,211,153,0.55)" borderColor="rgba(52,211,153,0.25)" min={0} max={168} onChange={v => updateCustom("scaleCd", v)} />
                            <CustomFieldInline label="Max / jour" value={customValues.maxScales} unit="" labelColor="rgba(52,211,153,0.55)" borderColor="rgba(52,211,153,0.25)" min={1} max={100} onChange={v => updateCustom("maxScales", v)} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 5. Safety controls summary (when profit engine active) ──── */}
          {hasRevenue && (
            <motion.div {...s(5)}>
              <div style={{ borderRadius: 16, border: `1px solid ${LINE}`, overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
                <div style={{ padding: "10px 16px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <ColLabel>Garde-fous actifs</ColLabel>
                  <span style={{ fontSize: 11, color: C(0.28) }}>Le robot ne peut pas dépasser ces limites</span>
                </div>
                <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 7 }}>
                  {safetyRows.map(([lbl, val]) => (
                    <motion.div key={`${lbl}-${key}`} {...s(0)} style={{
                      borderRadius: 10, border: `1px solid ${LINE}`,
                      background: "rgba(0,0,0,0.10)", padding: "9px 12px",
                      display: "flex", flexDirection: "column" as const, gap: 3,
                    }}>
                      <div style={{ fontSize: 11, color: C(0.34), lineHeight: 1.4 }}>{lbl}</div>
                      <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.03em", color: C(0.90) }}>{val}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 6. Engine preview ─────────────────────────────────────────── */}
          <motion.div key={`preview-mode-${engineMode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: EASE }} style={{
            borderRadius: 18,
            border: engineMode === "automatic" ? "1px solid rgba(52,211,153,0.12)" : "1px solid rgba(139,92,246,0.12)",
            background: engineMode === "automatic" ? "rgba(16,185,129,0.025)" : "rgba(139,92,246,0.025)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C(0.05)}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <ColLabel style={{ color: engineMode === "automatic" ? "rgba(167,243,208,0.55)" : "rgba(196,181,253,0.55)" }}>
                {engineMode === "automatic" ? "Ce que le moteur va exécuter" : "Ce que le moteur suggérerait"}
              </ColLabel>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: engineMode === "automatic" ? "rgba(167,243,208,0.40)" : "rgba(196,181,253,0.40)" }}>
                {engineMode === "automatic" ? "Exécution réelle" : "Simulation — aucune action"}
              </span>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {[
                {
                  tone: TONE.rose,
                  text: engineMode === "automatic" ? (
                    <>Si le ROI reste sous <strong style={{ color: TONE.rose.text }}>{p.kill}%</strong> pendant <strong style={{ color: C(0.88) }}>{p.killHold} min</strong> et que la dépense dépasse <strong style={{ color: C(0.88) }}>€{p.minSpend}</strong>, le moteur va <strong style={{ color: C(0.92) }}>mettre la campagne en pause</strong>.</>
                  ) : (
                    <>Si le ROI reste sous <strong style={{ color: TONE.rose.text }}>{p.kill}%</strong> pendant <strong style={{ color: C(0.88) }}>{p.killHold} min</strong>, le moteur <strong style={{ color: C(0.92) }}>suggère de mettre en pause</strong>. <span style={{ color: C(0.36) }}>Rien ne se passe automatiquement.</span></>
                  ),
                },
                {
                  tone: TONE.amber,
                  text: <>
                    Si le ROI est entre <strong style={{ color: TONE.amber.text }}>{p.watchLow}%</strong> et <strong style={{ color: TONE.amber.text }}>0%</strong>, le moteur <strong style={{ color: C(0.92) }}>vous alerte pour vérifier cette campagne</strong>. <span style={{ color: C(0.36) }}>Signal uniquement — dans les deux modes.</span>
                  </>,
                },
                {
                  tone: TONE.emerald,
                  text: engineMode === "automatic" ? (
                    <>Si le ROI dépasse <strong style={{ color: TONE.emerald.text }}>+{p.scaleRoi}%</strong>, dépense {'>'} <strong style={{ color: C(0.88) }}>€{p.minSpend * 2.5}</strong> et au moins <strong style={{ color: C(0.88) }}>{p.minConv} conversions</strong>, le moteur va <strong style={{ color: C(0.92) }}>augmenter le bid de +{p.scaleInc}%</strong>.</>
                  ) : (
                    <>Si le ROI dépasse <strong style={{ color: TONE.emerald.text }}>+{p.scaleRoi}%</strong>, le moteur <strong style={{ color: C(0.92) }}>suggère d&apos;augmenter le bid de +{p.scaleInc}%</strong>. <span style={{ color: C(0.36) }}>Rien ne se passe automatiquement.</span></>
                  ),
                },
              ].map((row, i) => (
                <motion.div key={`preview-${i}-${key}-${engineMode}`} {...s(i)} style={{
                  borderRadius: 11, border: row.tone.border, background: row.tone.bg,
                  padding: "11px 14px", fontSize: 13, lineHeight: 1.75, color: C(0.72),
                }}>
                  {row.text}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── 7. Recent engine actions ──────────────────────────────────── */}
          <div style={{ borderRadius: 18, border: `1px solid ${C(0.08)}`, overflow: "hidden", background: C(0.015) }}>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C(0.06)}` }}>
              <ColLabel>Dernières actions du moteur</ColLabel>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column" as const, gap: 7 }}>
              {actions.length === 0 && (
                <div style={{ padding: "18px 6px", fontSize: 12, color: C(0.28), textAlign: "center" as const }}>
                  Aucune action pour le moment — elles apparaîtront ici dès que le moteur aura traité vos campagnes.
                </div>
              )}
              {actions.slice(0, 5).map((r, i) => {
                const t = TONE[r.r];
                return (
                  <div key={i} style={{
                    borderRadius: 11, border: t.border, background: t.bg,
                    padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <div style={{ flexShrink: 0, marginTop: 1, display: "flex", flexDirection: "column" as const, alignItems: "flex-start", gap: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: t.text, border: `1px solid ${t.border}`, background: t.bg, padding: "3px 8px", borderRadius: 6 }}>
                        {r.type}
                      </span>
                      {r.isRecommend && (
                        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(196,181,253,0.55)" }}>
                          suggestion
                        </span>
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

          {/* ── 8. Emergency Stop ─────────────────────────────────────────── */}
          <motion.div {...s(6)} style={{
            borderRadius: 18,
            border: engPaused ? "1px solid rgba(251,191,36,0.28)" : `1px solid ${C(0.07)}`,
            background: engPaused ? "rgba(245,158,11,0.04)" : C(0.015),
            padding: "20px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 20, flexWrap: "wrap" as const, transition: "all 0.3s ease",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                {engPaused
                  ? <ShieldOff size={14} color="rgba(253,230,138,0.80)" />
                  : <Shield    size={14} color={C(0.38)} />
                }
                <span style={{ fontSize: 13, fontWeight: 600, color: engPaused ? "rgba(253,230,138,0.90)" : C(0.78) }}>
                  {engPaused ? "Automatisation suspendue" : "Arrêt d'urgence"}
                </span>
              </div>
              <p style={{ fontSize: 12, color: engPaused ? "rgba(251,191,36,0.55)" : C(0.35), margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
                {engPaused
                  ? `Toutes les actions automatiques sont suspendues jusqu'à ${fmtPausedUntil(pausedUntil)}. Les alertes restent actives.`
                  : "Suspend immédiatement toutes les actions Kill et Scale pour 24 heures. Utile si quelque chose se passe mal. Les alertes continuent à fonctionner."}
              </p>
            </div>
            <button
              onClick={handleEmergencyStop}
              disabled={pauseLoading}
              style={{
                height: 40, padding: "0 20px", borderRadius: 12,
                border: engPaused ? "1px solid rgba(251,191,36,0.30)" : "1px solid rgba(248,113,133,0.28)",
                background: engPaused ? "rgba(245,158,11,0.10)" : "rgba(244,63,94,0.08)",
                color: engPaused ? "rgba(253,230,138,0.85)" : "#fca5a5",
                fontSize: 12, fontWeight: 600,
                cursor: pauseLoading ? "default" : "pointer",
                opacity: pauseLoading ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: 7,
                whiteSpace: "nowrap" as const, transition: "all 0.25s ease", flexShrink: 0,
              }}
            >
              {engPaused
                ? <><Shield size={13} />Reprendre l&apos;automatisation</>
                : <><ShieldOff size={13} />Tout suspendre maintenant</>
              }
            </button>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
