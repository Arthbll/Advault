"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Save, CheckCircle2, Zap, BookOpen, ShieldOff, Shield, Play, AlertCircle, RefreshCw } from "lucide-react";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C    = (op: number) => `rgba(255,255,255,${op})`;
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
function s(i: number) {
  return { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.38, delay: i * 0.05, ease: EASE } };
}

// ─── Preset data ──────────────────────────────────────────────────────────────
type PresetKey = "soft" | "balanced" | "aggressive";
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
    kill: -25, watchLow: -10, scaleRoi: 25, scaleInc: 15,
    minSpend: 15, minConv: 2, killHold: 20, scaleHold: 45,
    killCd: 2, scaleCd: 4, maxKills: 8, maxScales: 3,
  },
};

// ─── Action row type ──────────────────────────────────────────────────────────
interface ActionRow {
  type:  string;
  camp:  string;
  ctx:   string;
  date:  string;
  r:     keyof typeof TONE;
}

const TONE = {
  rose:    { border: "rgba(251,113,133,0.16)", bg: "rgba(244,63,94,0.045)", text: "#fca5a5",  rowBg: "rgba(244,63,94,0.03)"  },
  amber:   { border: "rgba(251,191,36,0.16)",  bg: "rgba(245,158,11,0.04)", text: "#fcd34d",  rowBg: "rgba(245,158,11,0.025)" },
  emerald: { border: "rgba(52,211,153,0.16)",  bg: "rgba(16,185,129,0.04)", text: "#6ee7b7",  rowBg: "rgba(16,185,129,0.03)"  },
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
    type: mapped.label,
    camp: row.campaignName ?? "Unknown campaign",
    ctx:  row.message,
    date: dateStr,
    r:    mapped.r,
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DecisionRulesPage() {
  const [key,           setKey]           = useState<PresetKey>("balanced");
  const [saved,         setSaved]         = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [actions,       setActions]       = useState<ActionRow[]>(FALLBACK_ACTIONS);
  const [engineMode,    setEngineMode]    = useState<"automatic" | "recommendation">("automatic");
  const [engPaused,     setEngPaused]     = useState(false);
  const [pausedUntil,   setPausedUntil]   = useState<string | null>(null);
  const [pauseLoading,  setPauseLoading]  = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayMode,    setOverlayMode]    = useState<"automatic" | "recommendation">("automatic");
  const [mounted,        setMounted]        = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [scanResult,     setScanResult]     = useState<{ checked: number; killed: number; scaled: number; skipped: number; errors: string[] } | null>(null);
  const [scanError,      setScanError]      = useState(false);
  useEffect(() => setMounted(true), []);
  const p = PRESETS[key];

  // ── Load saved preset + engine mode on mount ─────────────────────────────
  useEffect(() => {
    fetch("/api/rules")
      .then(r => r.json())
      .then((data: { preset?: string; engineMode?: string }) => {
        if (data.preset === "soft" || data.preset === "balanced" || data.preset === "aggressive") {
          setKey(data.preset as PresetKey);
        }
        if (data.engineMode === "recommendation" || data.engineMode === "automatic") {
          setEngineMode(data.engineMode);
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
  }, []);

  // ── Load recent engine actions on mount ───────────────────────────────────
  useEffect(() => {
    fetch("/api/engine/actions?limit=5")
      .then(r => r.json())
      .then((data: { events?: Array<{
        id: string; state: string; tone: "rose" | "amber" | "emerald";
        campaign: string; network: string; detail: string;
        time: string; createdAt: string;
      }> }) => {
        if (Array.isArray(data.events) && data.events.length > 0) {
          setActions(data.events.map(ev => ({
            type: ev.state === "KILL" ? "Kill" : ev.state === "WATCH" ? "Watch" : "Scale",
            camp: ev.campaign || "Campaign",
            ctx:  ev.detail,
            date: ev.time,
            r:    ev.tone,
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
      await fetch("/api/rules", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        .then((d: { events?: Array<{ id: string; state: string; tone: "rose"|"amber"|"emerald"; campaign: string; network: string; detail: string; time: string }> }) => {
          if (Array.isArray(d.events) && d.events.length > 0) {
            setActions(d.events.map(ev => ({
              type: ev.state === "KILL" ? "Kill" : ev.state === "WATCH" ? "Watch" : "Scale",
              camp: ev.campaign || "Campaign",
              ctx:  ev.detail,
              date: ev.time,
              r:    ev.tone,
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

  return (
    <div style={{ padding: "28px 28px 64px", maxWidth: 1500, margin: "0 auto" }}>

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
                padding:        "44px 64px",
                textAlign:      "center",
                backdropFilter: "blur(32px)",
                boxShadow:      "0 40px 100px rgba(0,0,0,0.65)",
                overflow:       "hidden",
                minWidth:       460,
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
                fontSize: 56, fontWeight: 200, letterSpacing: "-0.07em", lineHeight: 1,
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
          gap:          24,
          flexWrap:     "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.22) }}>
              Decision Rules
            </div>
            <h1 style={{ margin: "10px 0 0", fontSize: 32, fontWeight: 300, letterSpacing: "-0.05em", lineHeight: 1.15, color: C(0.92) }}>
              Set when ProfitDash kills, flags, and scales campaigns.
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

            {/* ── Bloc 5: Engine Mode Toggle ─────────────────────────────── */}
            <div style={{
              display:      "flex",
              alignItems:   "center",
              borderRadius: 14,
              border:       `1px solid ${engineMode === "automatic" ? "rgba(74,222,128,0.22)" : "rgba(139,92,246,0.20)"}`,
              background:   engineMode === "automatic" ? "rgba(74,222,128,0.06)" : "rgba(139,92,246,0.06)",
              padding:      3,
              gap:          2,
              transition:   "all 0.25s ease",
            }}>
              {(["recommendation", "automatic"] as const).map(m => {
                const isActive = engineMode === m;
                const Icon = m === "automatic" ? Zap : BookOpen;
                return (
                  <button
                    key={m}
                    onClick={() => handleModeSwitch(m)}
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
                      cursor:        "pointer",
                      transition:    "all 0.18s ease",
                      display:       "flex",
                      alignItems:    "center",
                      gap:           5,
                      whiteSpace:    "nowrap" as const,
                    }}
                  >
                    <Icon size={11} />
                    {m === "automatic" ? "Automatic" : "Recommend"}
                  </button>
                );
              })}
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
              {(["soft", "balanced", "aggressive"] as PresetKey[]).map(k => (
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
        <div style={{ padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── B. Active preset summary ──────────────────────────────── */}
          <motion.div key={key} {...s(0)} style={{
            borderRadius: 13,
            border:       `1px solid ${C(0.07)}`,
            background:   C(0.02),
            padding:      "11px 18px",
            fontSize:     13,
            color:        C(0.70),
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            flexWrap:     "wrap",
          }}>
            <span style={{ color: "rgba(196,181,253,0.90)", fontWeight: 600 }}>{p.label}</span>
            <span style={{ color: C(0.22) }}>—</span>
            <span>Kill below <strong style={{ color: C(0.88) }}>{p.kill}%</strong></span>
            <span style={{ color: C(0.22) }}>·</span>
            <span>Watch <strong style={{ color: C(0.88) }}>{p.watchLow}%</strong> to <strong style={{ color: C(0.88) }}>0%</strong></span>
            <span style={{ color: C(0.22) }}>·</span>
            <span>Scale above <strong style={{ color: C(0.88) }}>+{p.scaleRoi}%</strong></span>
            <span style={{ color: C(0.22) }}>·</span>
            <span>Scale increment <strong style={{ color: C(0.88) }}>+{p.scaleInc}%</strong></span>
            {/* Bloc 5: mode indicator */}
            <span style={{ color: C(0.22) }}>·</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
              color: engineMode === "automatic" ? "rgba(134,239,172,0.85)" : "rgba(196,181,253,0.80)",
            }}>
              {engineMode === "automatic" ? <Zap size={10} /> : <BookOpen size={10} />}
              {engineMode === "automatic" ? "Automatic" : "Recommendation"}
            </span>
          </motion.div>

          {/* ── C + D. Matrix + Safety side by side ───────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 }}>

            {/* C. Decision matrix */}
            <div style={{
              borderRadius: 18,
              border:       `1px solid ${C(0.08)}`,
              overflow:     "hidden",
              background:   "linear-gradient(180deg,rgba(14,15,23,0.96),rgba(8,9,14,0.98))",
            }}>
              {/* Column headers */}
              <div style={{
                display:           "grid",
                gridTemplateColumns: "130px 1fr 1fr 110px",
                gap:               16,
                padding:           "12px 20px",
                borderBottom:      `1px solid ${C(0.06)}`,
              }}>
                <ColLabel>Decision</ColLabel>
                <ColLabel>Trigger</ColLabel>
                <ColLabel>Action</ColLabel>
                <ColLabel>Mode</ColLabel>
              </div>

              {/* Kill row */}
              <motion.div key={`kill-${key}`} {...s(1)} style={{
                display:           "grid",
                gridTemplateColumns: "130px 1fr 1fr 110px",
                gap:               16,
                padding:           "18px 20px",
                borderBottom:      `1px solid ${C(0.05)}`,
                background:        TONE.rose.rowBg,
                alignItems:        "center",
              }}>
                <div><DecisionBadge label="Kill" color="#f87171" /></div>
                <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>
                  ROI &lt; <span style={{ color: TONE.rose.text }}>{p.kill}%</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>
                  {engineMode === "automatic" ? "Pause campaign" : "Suggest pause"}
                </div>
                <ModePill role="kill" mode={engineMode} />
              </motion.div>

              {/* Watch row */}
              <motion.div key={`watch-${key}`} {...s(2)} style={{
                display:           "grid",
                gridTemplateColumns: "130px 1fr 1fr 110px",
                gap:               16,
                padding:           "18px 20px",
                borderBottom:      `1px solid ${C(0.05)}`,
                background:        TONE.amber.rowBg,
                alignItems:        "center",
              }}>
                <div><DecisionBadge label="Watch" color="#fbbf24" /></div>
                <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>
                  ROI <span style={{ color: TONE.amber.text }}>{p.watchLow}%</span> → <span style={{ color: TONE.amber.text }}>0%</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>
                  Flag for review
                </div>
                <ModePill role="watch" mode={engineMode} />
              </motion.div>

              {/* Scale row */}
              <motion.div key={`scale-${key}`} {...s(3)} style={{
                display:           "grid",
                gridTemplateColumns: "130px 1fr 1fr 110px",
                gap:               16,
                padding:           "18px 20px",
                background:        TONE.emerald.rowBg,
                alignItems:        "center",
              }}>
                <div><DecisionBadge label="Scale" color="#34d399" /></div>
                <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>
                  ROI &gt; <span style={{ color: TONE.emerald.text }}>+{p.scaleRoi}%</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: C(0.90) }}>
                  {engineMode === "automatic" ? `Bid +${p.scaleInc}%` : `Suggest bid +${p.scaleInc}%`}
                </div>
                <ModePill role="scale" mode={engineMode} />
              </motion.div>
            </div>

            {/* D. Safety controls */}
            <div style={{
              borderRadius: 18,
              border:       `1px solid ${C(0.08)}`,
              overflow:     "hidden",
              background:   C(0.015),
            }}>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C(0.06)}` }}>
                <ColLabel>Safety controls</ColLabel>
              </div>
              <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {safetyRows.map(([label, val]) => (
                  <motion.div key={`${label}-${key}`} {...s(0)} style={{
                    borderRadius: 10,
                    border:       `1px solid ${C(0.07)}`,
                    background:   "rgba(0,0,0,0.10)",
                    padding:      "9px 12px",
                    display:      "flex",
                    flexDirection: "column",
                    gap:          3,
                  }}>
                    <div style={{ fontSize: 11, color: C(0.36), lineHeight: 1.4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.03em", color: C(0.90) }}>{val}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ── E. Engine preview ─────────────────────────────────────── */}
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

          {/* ── F + G. Recent actions + Network overrides ─────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 14 }}>

            {/* F. Recent engine actions */}
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
                {actions.map((r, i) => {
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
                      <span style={{
                        flexShrink: 0, marginTop: 1,
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
                        textTransform: "uppercase", color: t.text,
                        border: `1px solid ${t.border}`,
                        background: t.bg,
                        padding: "3px 8px", borderRadius: 6,
                      }}>{r.type}</span>
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

            {/* G. Network overrides */}
            <div style={{
              borderRadius: 18,
              border:       `1px solid ${C(0.08)}`,
              overflow:     "hidden",
              background:   C(0.015),
            }}>
              <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C(0.06)}` }}>
                <ColLabel>Network overrides</ColLabel>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { net: "Global default",       desc: "Applies everywhere",     status: "Enabled", draft: false },
                  { net: "ExoClick",             desc: "Using global rules",      status: "Enabled", draft: false },
                  { net: "TrafficStars",         desc: "Using global rules",      status: "Enabled", draft: false },
                  { net: "TrafficJunky",         desc: "Pending setup",           status: "Draft",   draft: true  },
                ].map(n => (
                  <div key={n.net} style={{
                    borderRadius:   11,
                    border:         n.draft ? "1px solid rgba(251,191,36,0.14)" : `1px solid ${C(0.07)}`,
                    background:     n.draft ? "rgba(245,158,11,0.03)" : "rgba(0,0,0,0.10)",
                    padding:        "10px 14px",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    gap:            10,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, color: n.draft ? "rgba(253,230,138,0.80)" : C(0.82) }}>{n.net}</div>
                      <div style={{ fontSize: 11, color: n.draft ? "rgba(251,191,36,0.42)" : C(0.34), marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color:   n.draft ? "rgba(253,230,138,0.80)" : C(0.48),
                      border:  n.draft ? "1px solid rgba(251,191,36,0.16)" : `1px solid ${C(0.10)}`,
                      background: n.draft ? "rgba(245,158,11,0.06)" : C(0.03),
                      padding: "3px 9px", borderRadius: 6,
                    }}>{n.status}</span>
                  </div>
                ))}
              </div>
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
