"use client";

/**
 * Decision Engine — full configuration page.
 *
 * Loads from   GET  /api/rules
 * Saves to     PUT  /api/rules
 * Emergency    POST /api/engine/emergency-stop
 * Run scan     POST /api/kill-switch/run
 * Activity log GET  /api/logs?limit=40
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DecisionRule {
  preset:         string;
  engineMode:     string; // "automatic" | "recommendation"
  killRoi:        number;
  watchLow:       number;
  watchHigh:      number;
  scaleRoi:       number;
  scaleIncrement: number;
  minSpend:       number;
  minConversions: number;
  killHoldMin:    number;
  scaleHoldMin:   number;
  killCooldownH:  number;
  scaleCooldownH: number;
  maxKillsDay:    number;
  maxScalesDay:   number;
}

interface LogEntry { id: string; ts: string; msg: string; type: "kill" | "scale" | "info" | "recommend"; }

// ── Presets ────────────────────────────────────────────────────────────────────

const PRESETS: Record<string, Partial<DecisionRule>> = {
  soft: {
    killRoi: -60, watchLow: -30, watchHigh: 0,
    scaleRoi: 50, scaleIncrement: 5,
    minSpend: 50, minConversions: 5,
    killHoldMin: 60, scaleHoldMin: 120,
    killCooldownH: 6, scaleCooldownH: 12,
    maxKillsDay: 3, maxScalesDay: 1,
  },
  balanced: {
    killRoi: -30, watchLow: -15, watchHigh: 0,
    scaleRoi: 30, scaleIncrement: 10,
    minSpend: 20, minConversions: 3,
    killHoldMin: 30, scaleHoldMin: 60,
    killCooldownH: 3, scaleCooldownH: 6,
    maxKillsDay: 5, maxScalesDay: 2,
  },
  aggressive: {
    killRoi: -15, watchLow: -5, watchHigh: 0,
    scaleRoi: 15, scaleIncrement: 20,
    minSpend: 10, minConversions: 1,
    killHoldMin: 10, scaleHoldMin: 20,
    killCooldownH: 1, scaleCooldownH: 2,
    maxKillsDay: 10, maxScalesDay: 5,
  },
};

const PRESET_LABELS: Record<string, string> = {
  soft: "Soft", balanced: "Balanced", aggressive: "Aggressive", custom: "Custom",
};

const DEFAULTS: DecisionRule = {
  preset: "balanced", engineMode: "automatic",
  ...PRESETS.balanced,
} as DecisionRule;

// ── Style tokens ───────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.02)",
  padding: "20px 22px",
};

const LABEL_SM: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.30)",
  marginBottom: 7,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "8px 11px",
  borderRadius: 10, fontSize: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.85)",
  outline: "none",
  boxSizing: "border-box" as const,
  colorScheme: "dark" as const,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function NumField({
  label, value, onChange, min, max, step = 1, unit = "",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div>
      <div style={LABEL_SM}>{label}</div>
      <div style={{ position: "relative" }}>
        <input
          type="number" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={INPUT_STYLE}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
          onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        />
        {unit && (
          <span style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 11, color: "rgba(255,255,255,0.30)", pointerEvents: "none",
          }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

function ModeToggle({
  mode, onChange,
}: {
  mode: string; onChange: (m: string) => void;
}) {
  return (
    <div style={{
      display: "inline-flex",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: 3, gap: 2,
    }}>
      {(["automatic", "recommendation"] as const).map(m => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              padding: "5px 14px", borderRadius: 9, fontSize: 12, fontWeight: active ? 500 : 400,
              border: "none", cursor: "pointer", transition: "all 0.18s",
              background: active ? "rgba(255,255,255,0.10)" : "transparent",
              color: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)",
            }}
          >
            {m === "automatic" ? "Automatic" : "Recommend"}
          </button>
        );
      })}
    </div>
  );
}

function PresetPill({ preset, active, onClick }: { preset: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 13px", borderRadius: 9999, fontSize: 11, fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? "rgba(167,139,250,0.40)" : "rgba(255,255,255,0.08)"}`,
        background: active ? "rgba(139,92,246,0.10)" : "transparent",
        color: active ? "rgba(221,214,254,1)" : "rgba(255,255,255,0.40)",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {PRESET_LABELS[preset] ?? preset}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function KillSwitchSettings() {
  const [cfg, setCfg]           = useState<DecisionRule>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [scanning, setScanning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [enginePaused, setEnginePaused] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [preview, setPreview]   = useState<string[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Load engine config + logs ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, logsRes, statusRes] = await Promise.all([
        fetch("/api/rules"),
        fetch("/api/logs?limit=40"),
        fetch("/api/engine/emergency-stop"),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json() as DecisionRule;
        setCfg(prev => ({ ...prev, ...data }));
      }

      if (logsRes.ok) {
        const data = await logsRes.json() as { logs: { id: string; type: string; message: string; createdAt: string }[] };
        const mapped: LogEntry[] = (data.logs ?? []).map(l => {
          const d   = new Date(l.createdAt);
          const hh  = String(d.getHours()).padStart(2, "0");
          const mm  = String(d.getMinutes()).padStart(2, "0");
          const ss  = String(d.getSeconds()).padStart(2, "0");
          const isKill      = l.type === "KILL_SWITCH_TRIGGERED";
          const isScale     = l.type === "CAMPAIGN_ACTION" && l.message.includes("Budget");
          const isRecommend = l.message.startsWith("[RECOMMEND]");
          return {
            id:   l.id,
            ts:   `${hh}:${mm}:${ss}`,
            msg:  l.message,
            type: isRecommend ? "recommend" : isKill ? "kill" : isScale ? "scale" : "info",
          };
        });
        setLogs(mapped.length ? mapped : [{ id: "empty", ts: "--:--:--", msg: "No engine events recorded yet", type: "info" }]);
      }

      if (statusRes.ok) {
        const s = await statusRes.json() as { paused?: boolean };
        setEnginePaused(s.paused ?? false);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  // ── Preset application ────────────────────────────────────────────────────────
  function applyPreset(name: string) {
    if (name === "custom") return;
    const p = PRESETS[name];
    if (!p) return;
    setCfg(prev => ({ ...prev, ...p, preset: name }));
  }

  // ── Field change → mark as custom ────────────────────────────────────────────
  function update<K extends keyof DecisionRule>(key: K, value: DecisionRule[K]) {
    setCfg(prev => ({ ...prev, [key]: value, preset: "custom" }));
  }

  // ── Preview generator ─────────────────────────────────────────────────────────
  useEffect(() => {
    const lines: string[] = [];
    const verb = cfg.engineMode === "automatic" ? "will" : "would";
    lines.push(
      `Engine ${verb} kill campaigns with ROI < ${cfg.killRoi}% after holding for ${cfg.killHoldMin} min`,
    );
    lines.push(
      `Engine ${verb} flag campaigns in watch zone: ${cfg.watchLow}% → ${cfg.watchHigh}%`,
    );
    lines.push(
      `Engine ${verb} scale budget +${cfg.scaleIncrement}% when ROI > ${cfg.scaleRoi}% (after ${cfg.scaleHoldMin} min)`,
    );
    lines.push(
      `Min spend: €${cfg.minSpend} · Min conversions: ${cfg.minConversions} before any decision`,
    );
    lines.push(
      `Kill cooldown: ${cfg.killCooldownH}h · Scale cooldown: ${cfg.scaleCooldownH}h · Max kills/day: ${cfg.maxKillsDay}`,
    );
    if (cfg.engineMode === "recommendation") {
      lines.push("⚠ Recommend mode — no real actions executed. Suggestions appear in Activity Log.");
    }
    setPreview(lines);
  }, [cfg]);

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (res.ok) {
        showToast("Engine configuration saved", true);
      } else {
        const j = await res.json().catch(() => ({})) as { error?: string };
        showToast(j.error ?? "Save failed", false);
      }
    } catch {
      showToast("Network error", false);
    }
    setSaving(false);
  }

  // ── Run scan ──────────────────────────────────────────────────────────────────
  async function runScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/kill-switch/run", { method: "POST" });
      const j   = await res.json() as { killed?: number; checked?: number; skipped?: boolean };
      if (j.skipped) {
        showToast("Kill-switch is disabled — enable it in settings", false);
      } else {
        const label = cfg.engineMode === "recommendation" ? "scan (Recommend mode)" : "scan";
        showToast(`${label}: ${j.checked ?? 0} campaigns checked, ${j.killed ?? 0} acted on`, true);
        await loadData();
      }
    } catch {
      showToast("Scan error", false);
    }
    setScanning(false);
  }

  // ── Emergency stop ────────────────────────────────────────────────────────────
  async function toggleEmergencyStop() {
    setStopping(true);
    try {
      const action = enginePaused ? "resume" : "pause";
      const res = await fetch("/api/engine/emergency-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setEnginePaused(!enginePaused);
        showToast(enginePaused ? "Engine resumed" : "Engine paused — no automated actions will run", enginePaused);
      }
    } catch {
      showToast("Error toggling engine", false);
    }
    setStopping(false);
  }

  // ── Log type colors ───────────────────────────────────────────────────────────
  const logColor = (t: LogEntry["type"]) => {
    if (t === "kill")      return "#c87171";
    if (t === "scale")     return "#6b9e82";
    if (t === "recommend") return "rgba(167,139,250,0.85)";
    return "rgba(255,255,255,0.38)";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "rgba(255,255,255,0.30)", fontSize: 13 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
          <RefreshCw size={16} />
        </motion.div>
        <span style={{ marginLeft: 10 }}>Loading engine configuration…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap" as const, gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>
            Decision Engine
          </div>
          <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.88)" }}>
            Engine configuration
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
          <ModeToggle mode={cfg.engineMode} onChange={m => setCfg(prev => ({ ...prev, engineMode: m }))} />

          <button
            onClick={runScan} disabled={scanning}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 15px", borderRadius: 10, fontSize: 12, fontWeight: 500,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.75)",
              cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            {scanning ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
                <RefreshCw size={12} />
              </motion.div>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {cfg.engineMode === "recommendation" ? "Preview scan" : "Run scan"}
          </button>

          <button
            onClick={save} disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 18px", borderRadius: 10, fontSize: 12, fontWeight: 500,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.90)",
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            {saving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
                <RefreshCw size={12} />
              </motion.div>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            Save
          </button>
        </div>
      </div>

      {/* Recommend-mode callout */}
      <AnimatePresence>
        {cfg.engineMode === "recommendation" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              padding: "9px 16px", borderRadius: 12,
              background: "rgba(139,92,246,0.07)",
              border: "1px solid rgba(167,139,250,0.18)",
              fontSize: 12, color: "rgba(221,214,254,0.85)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(167,139,250,0.9)", flexShrink: 0, boxShadow: "0 0 6px rgba(167,139,250,0.6)" }} />
            Recommend mode active — the engine evaluates all rules but logs suggestions only. No campaigns will be paused or scaled automatically.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Preset selector ──────────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <div style={LABEL_SM}>Profile preset</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          {["soft", "balanced", "aggressive", "custom"].map(p => (
            <PresetPill key={p} preset={p} active={cfg.preset === p} onClick={() => applyPreset(p)} />
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.22)" }}>
          {cfg.preset === "soft" && "Conservative thresholds — protects campaigns, minimal intervention."}
          {cfg.preset === "balanced" && "Balanced defaults — recommended for most media buyers."}
          {cfg.preset === "aggressive" && "Tight thresholds — maximum control, high intervention frequency."}
          {cfg.preset === "custom" && "Custom configuration — thresholds set manually."}
        </div>
      </div>

      {/* ── Rule cards ───────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>

        {/* Kill */}
        <div style={{
          ...CARD,
          borderColor: "rgba(201,98,98,0.20)",
          background: "rgba(201,98,98,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c96262", boxShadow: "0 0 7px rgba(201,98,98,0.5)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#c96262", textTransform: "uppercase" as const, letterSpacing: "0.12em" }}>Kill</span>
          </div>
          <NumField
            label="ROI threshold (%)"
            value={cfg.killRoi} onChange={v => update("killRoi", v)}
            min={-100} max={-1} unit="%"
          />
          <div style={{ marginTop: 10 }}>
            <NumField
              label="Hold before kill (min)"
              value={cfg.killHoldMin} onChange={v => update("killHoldMin", v)}
              min={5} max={360} unit="min"
            />
          </div>
          <p style={{ fontSize: 10, color: "rgba(201,98,98,0.6)", marginTop: 10 }}>
            {cfg.engineMode === "automatic"
              ? `Pauses campaign on network if ROI < ${cfg.killRoi}% for ${cfg.killHoldMin} min`
              : `Would suggest killing if ROI < ${cfg.killRoi}% for ${cfg.killHoldMin} min`
            }
          </p>
        </div>

        {/* Watch */}
        <div style={{
          ...CARD,
          borderColor: "rgba(251,191,36,0.18)",
          background: "rgba(245,158,11,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#c9a332", boxShadow: "0 0 7px rgba(201,163,50,0.5)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#c9a332", textTransform: "uppercase" as const, letterSpacing: "0.12em" }}>Watch</span>
          </div>
          <NumField
            label="Lower bound (%)"
            value={cfg.watchLow} onChange={v => update("watchLow", v)}
            min={-100} max={0} unit="%"
          />
          <div style={{ marginTop: 10 }}>
            <div style={LABEL_SM}>Upper bound (%)</div>
            <div style={{
              padding: "8px 11px", borderRadius: 10, fontSize: 13,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.35)",
            }}>
              0% (fixed)
            </div>
          </div>
          <p style={{ fontSize: 10, color: "rgba(201,163,50,0.6)", marginTop: 10 }}>
            Campaigns in zone {cfg.watchLow}% → 0% are monitored but not actioned
          </p>
        </div>

        {/* Scale */}
        <div style={{
          ...CARD,
          borderColor: "rgba(107,158,130,0.22)",
          background: "rgba(107,158,130,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6b9e82", boxShadow: "0 0 7px rgba(107,158,130,0.5)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6b9e82", textTransform: "uppercase" as const, letterSpacing: "0.12em" }}>Scale</span>
          </div>
          <NumField
            label="ROI target (%)"
            value={cfg.scaleRoi} onChange={v => update("scaleRoi", v)}
            min={1} max={500} unit="%"
          />
          <div style={{ marginTop: 10 }}>
            <NumField
              label="Budget increment (%)"
              value={cfg.scaleIncrement} onChange={v => update("scaleIncrement", v)}
              min={1} max={200} unit="%"
            />
          </div>
          <p style={{ fontSize: 10, color: "rgba(107,158,130,0.6)", marginTop: 10 }}>
            {cfg.engineMode === "automatic"
              ? `Scales budget +${cfg.scaleIncrement}% when ROI > ${cfg.scaleRoi}%`
              : `Would suggest scaling +${cfg.scaleIncrement}% when ROI > ${cfg.scaleRoi}%`
            }
          </p>
        </div>
      </div>

      {/* ── Rules matrix ─────────────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <div style={LABEL_SM}>Rules matrix</div>
        <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
          <thead>
            <tr>
              {["Decision", "Trigger", "Action", "Mode"].map(h => (
                <th key={h} style={{
                  textAlign: "left" as const, padding: "6px 10px 10px",
                  color: "rgba(255,255,255,0.28)", fontWeight: 500, fontSize: 10,
                  textTransform: "uppercase" as const, letterSpacing: "0.12em",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                decision: "Kill",
                trigger:  `ROI < ${cfg.killRoi}% for ${cfg.killHoldMin} min`,
                action:   cfg.engineMode === "automatic" ? "Pause on network + KILLED in DB" : "Log suggestion only",
                modeColor: cfg.engineMode === "automatic" ? "#c96262" : "rgba(167,139,250,0.85)",
                modeTxt:   cfg.engineMode === "automatic" ? "Executes" : "Suggests",
              },
              {
                decision: "Watch",
                trigger:  `ROI in ${cfg.watchLow}% → 0%`,
                action:   "Flag for review",
                modeColor: "rgba(255,255,255,0.38)",
                modeTxt:   "Always flags",
              },
              {
                decision: "Scale",
                trigger:  `ROI > ${cfg.scaleRoi}% for ${cfg.scaleHoldMin} min`,
                action:   cfg.engineMode === "automatic" ? `Budget +${cfg.scaleIncrement}% on network` : "Log suggestion only",
                modeColor: cfg.engineMode === "automatic" ? "#6b9e82" : "rgba(167,139,250,0.85)",
                modeTxt:   cfg.engineMode === "automatic" ? "Executes" : "Suggests",
              },
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.70)", fontWeight: 500 }}>{row.decision}</td>
                <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 11 }}>{row.trigger}</td>
                <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.55)" }}>{row.action}</td>
                <td style={{ padding: "10px 10px" }}>
                  <span style={{ color: row.modeColor, fontWeight: 500 }}>{row.modeTxt}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Safeguards ───────────────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <div style={LABEL_SM}>Safeguards</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          <NumField label="Min spend before decision" value={cfg.minSpend} onChange={v => update("minSpend", v)} min={0} unit="€" />
          <NumField label="Min conversions before scale" value={cfg.minConversions} onChange={v => update("minConversions", v)} min={0} />
          <NumField label="Kill hold (min)" value={cfg.killHoldMin} onChange={v => update("killHoldMin", v)} min={0} unit="min" />
          <NumField label="Scale hold (min)" value={cfg.scaleHoldMin} onChange={v => update("scaleHoldMin", v)} min={0} unit="min" />
          <NumField label="Kill cooldown" value={cfg.killCooldownH} onChange={v => update("killCooldownH", v)} min={0} unit="h" />
          <NumField label="Scale cooldown" value={cfg.scaleCooldownH} onChange={v => update("scaleCooldownH", v)} min={0} unit="h" />
          <NumField label="Max kills / day" value={cfg.maxKillsDay} onChange={v => update("maxKillsDay", v)} min={1} />
          <NumField label="Max scales / day" value={cfg.maxScalesDay} onChange={v => update("maxScalesDay", v)} min={1} />
        </div>
      </div>

      {/* ── Preview ──────────────────────────────────────────────────────────── */}
      <div style={{ ...CARD, borderColor: "rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={LABEL_SM}>
            {cfg.engineMode === "automatic" ? "Will execute" : "Would suggest"}
          </div>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.engineMode === "automatic" ? "#6b9e82" : "rgba(167,139,250,0.9)", marginBottom: 7 }} />
        </div>
        <div style={{
          background: "rgba(0,0,0,0.30)", borderRadius: 12, padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {preview.map((line, i) => (
            <div key={i} style={{
              fontSize: 11, color: line.startsWith("⚠")
                ? "rgba(253,230,138,0.75)"
                : "rgba(255,255,255,0.52)",
              fontFamily: "monospace", lineHeight: 1.5,
            }}>
              {!line.startsWith("⚠") && <span style={{ color: "rgba(107,158,130,0.6)", marginRight: 6 }}>›</span>}
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity log ─────────────────────────────────────────────────────── */}
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={LABEL_SM}>Activity log</div>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: "50%", background: "#6b9e82", marginBottom: 7 }}
            />
          </div>
          <button
            onClick={loadData}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.28)", fontSize: 11, padding: "2px 6px",
              display: "flex", alignItems: "center", gap: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.60)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>

        <div
          ref={logsRef}
          style={{
            height: 180, overflowY: "auto", background: "rgba(0,0,0,0.40)",
            borderRadius: 10, padding: "10px 12px",
            fontFamily: "monospace", fontSize: 11, lineHeight: 1.65,
          }}
        >
          <AnimatePresence>
            {logs.map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{ display: "flex", gap: 8, marginBottom: 3 }}
              >
                <span style={{ color: "rgba(255,255,255,0.20)", flexShrink: 0 }}>[{log.ts}]</span>
                <span style={{ color: logColor(log.type) }}>{log.msg}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Emergency stop ───────────────────────────────────────────────────── */}
      <div style={{
        ...CARD,
        borderColor: enginePaused ? "rgba(251,191,36,0.22)" : "rgba(160,80,80,0.18)",
        background: enginePaused ? "rgba(245,158,11,0.04)" : "rgba(160,80,80,0.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: enginePaused ? "rgba(253,230,138,0.85)" : "rgba(255,255,255,0.70)", marginBottom: 3 }}>
              {enginePaused ? "Engine paused — emergency stop active" : "Emergency stop"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
              {enginePaused
                ? "All automated actions are suspended. No campaigns will be touched."
                : "Immediately suspends all automated engine actions across every network."
              }
            </div>
          </div>
          <button
            onClick={toggleEmergencyStop}
            disabled={stopping}
            style={{
              padding: "8px 18px", borderRadius: 10, fontSize: 12, fontWeight: 500,
              border: enginePaused
                ? "1px solid rgba(251,191,36,0.30)"
                : "1px solid rgba(160,80,80,0.28)",
              background: enginePaused
                ? "rgba(245,158,11,0.10)"
                : "rgba(160,80,80,0.09)",
              color: enginePaused ? "rgba(253,230,138,0.90)" : "rgba(220,100,100,0.90)",
              cursor: stopping ? "not-allowed" : "pointer",
              opacity: stopping ? 0.6 : 1,
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {stopping ? "…" : enginePaused ? "Resume engine" : "Stop engine"}
          </button>
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: "10px 14px", borderRadius: 12, fontSize: 12,
              background: toast.ok ? "rgba(107,158,130,0.08)" : "rgba(160,80,80,0.08)",
              color: toast.ok ? "#6b9e82" : "#c07070",
              border: `1px solid ${toast.ok ? "rgba(107,158,130,0.14)" : "rgba(160,80,80,0.14)"}`,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
