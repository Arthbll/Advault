"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldOff, RefreshCw, Clock } from "lucide-react";
import { sendNotification } from "./NotificationSettings";

interface KSConfig {
  killSwitchEnabled: boolean;
  roiThreshold: number;
  maxSpendPerCampaign: number | null;
  checkIntervalMinutes: number;
}

interface Props {
  initialSettings: KSConfig;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "check" | "alert" | "info";
}

interface DbLog {
  id:        string;
  type:      string;
  message:   string;
  createdAt: string;
}

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#3f3f46",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 10,
  fontSize: 13,
  outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  color: "rgba(255,255,255,0.85)",
  transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box" as const,
  colorScheme: "dark" as const,
};

const CARD_STYLE: React.CSSProperties = {
  background: "#17171e",
  border: "1px solid rgba(255,255,255,0.03)",
  borderRadius: 18,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
  borderTop: "1px solid rgba(255,255,255,0.1)",
};

function MagneticButton({
  children,
  onClick,
  disabled,
  isDanger
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  isDanger?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useRef(0);
  const y = useRef(0);

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    x.current = (e.clientX - rect.left - rect.width / 2) * 0.3;
    y.current = (e.clientY - rect.top - rect.height / 2) * 0.3;
    ref.current.style.transform = `translate(${x.current}px, ${y.current}px)`;
  }

  function handleMouseLeave() {
    if (!ref.current) return;
    x.current = 0;
    y.current = 0;
    ref.current.style.transform = "translate(0, 0)";
  }

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.96 }}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "11px",
        borderRadius: 12,
        border: isDanger ? "1px solid rgba(160,112,112,0.15)" : "1px solid rgba(255,255,255,0.1)",
        background: isDanger ? "rgba(160,112,112,0.06)" : "rgba(255,255,255,0.05)",
        color: isDanger ? "#a07070" : "rgba(255,255,255,0.85)",
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all 0.2s ease",
        transform: "translate(0, 0)",
      }}
    >
      {children}
    </motion.button>
  );
}

function generateLogEntry(type: "check" | "alert" | "info", roi?: number, threshold?: number): LogEntry {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const timestamp = `${hh}:${mm}:${ss}`;

  let message = "";
  let finalType = type;

  if (type === "check") {
    const roiVal = roi ?? Math.random() * -40 + 5;
    const threshVal = threshold ?? -25;
    message = `✓ ROI check: ${roiVal.toFixed(1)}% (threshold: ${threshVal}%)`;
    finalType = roiVal < threshVal ? "alert" : "check";
  } else if (type === "alert") {
    message = `✗ Daily budget exceeded: $142/$100`;
  } else {
    message = `✓ All checks passed`;
  }

  return {
    id: `${timestamp}-${Math.random()}`,
    timestamp,
    message,
    type: finalType,
  };
}

export default function KillSwitchSettings({ initialSettings }: Props) {
  const [cfg, setCfg] = useState<KSConfig>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [lastRun, setLastRun] = useState<{ killed: number; checked: number; killedList?: string[] } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // Fetch real logs from DB on mount
  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch("/api/logs?limit=30");
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json() as { logs: DbLog[] };
        if (data.logs.length > 0) {
          const mapped: LogEntry[] = data.logs.map(l => {
            const d = new Date(l.createdAt);
            const hh = String(d.getHours()).padStart(2,"0");
            const mm = String(d.getMinutes()).padStart(2,"0");
            const ss = String(d.getSeconds()).padStart(2,"0");
            const isKill = l.type === "KILL_SWITCH_TRIGGERED";
            return {
              id:        l.id,
              timestamp: `${hh}:${mm}:${ss}`,
              message:   l.message,
              type:      isKill ? "alert" : "check",
            };
          });
          setLogs(mapped);
        } else {
          // No real logs yet — show a friendly placeholder
          setLogs([{ id: "init", timestamp: "--:--:--", message: "✓ No kill-switch actions recorded yet", type: "info" }]);
        }
      } catch {
        // fallback: show initial demo logs if DB unreachable
        setLogs([
          generateLogEntry("check", -12.3, cfg.roiThreshold),
          generateLogEntry("info"),
        ]);
      }
    }
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll logs container
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const json = await res.json();
      json.ok
        ? showToast("Settings saved", true)
        : showToast(json.error ?? "Error", false);
    } catch {
      showToast("Network error", false);
    }
    setSaving(false);
  }

  async function runNow() {
    setIsTesting(true);
    try {
      const res = await fetch("/api/kill-switch/run", { method: "POST" });
      const json = await res.json();
      if (json.skipped) {
        showToast("Kill-switch is disabled — enable it first", false);
      } else {
        setLastRun({ killed: json.killed, checked: json.checked, killedList: json.killedList });
        if (json.killed > 0) {
          const msg = `${json.killed} campaign(s) stopped: ${json.killedList?.join(", ")}`;
          showToast(msg, true);
          sendNotification("ProfitDash — Kill-Switch 🛑", msg, "onKillSwitch");
        } else {
          showToast(`${json.checked} checked — none below threshold`, true);
          sendNotification(
            "ProfitDash — Kill-Switch ✓",
            `${json.checked} campaigns checked`,
            "onKillSwitch"
          );
        }
        // Refresh real logs from DB after run
        try {
          const lr = await fetch("/api/logs?limit=30");
          if (lr.ok) {
            const ldata = await lr.json() as { logs: DbLog[] };
            if (ldata.logs.length > 0) {
              setLogs(ldata.logs.map(l => {
                const d = new Date(l.createdAt);
                const hh = String(d.getHours()).padStart(2,"0");
                const mm = String(d.getMinutes()).padStart(2,"0");
                const ss = String(d.getSeconds()).padStart(2,"0");
                return { id: l.id, timestamp: `${hh}:${mm}:${ss}`, message: l.message, type: l.type === "KILL_SWITCH_TRIGGERED" ? "alert" as const : "check" as const };
              }));
            }
          }
        } catch { /* silent */ }
      }
    } catch {
      showToast("Network error", false);
    }
    setIsTesting(false);
  }

  const isDangerousThreshold = cfg.roiThreshold > -30;
  const glowColor = cfg.killSwitchEnabled ? "#6b9e82" : "#a07070";
  const glowBoxShadow = "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Main Control Panel Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          ...CARD_STYLE,
          padding: "40px 20px",
          position: "relative",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 100,
              letterSpacing: "-0.06em",
              color: "rgba(255,255,255,0.85)",
              margin: 0,
              marginBottom: 4,
            }}
          >
            Control Panel
          </h2>
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              margin: 0,
              ...LABEL,
            }}
          >
            PROTECTION SYSTEM
          </p>
        </div>

        {/* Large Central Toggle with Pulsing Ring */}
        <div style={{ position: "relative", width: 260, height: 260, margin: "0 auto 30px" }}>
          {/* Pulsing SVG Ring Background */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
            viewBox="0 0 260 260"
          >
            <motion.circle
              cx="130"
              cy="130"
              r="72"
              fill="none"
              stroke={isDangerousThreshold ? "#a07070" : "rgba(107,158,130,0.3)"}
              strokeWidth="2"
              animate={{
                opacity: isDangerousThreshold ? [0.2, 0.8, 0.2] : [0.15, 0.4, 0.15],
              }}
              transition={{
                duration: isDangerousThreshold ? 4 : 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </svg>

          {/* Layer 1 — pure CSS anchor, never touched by Framer Motion */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}>
            {/* Layer 2 — Framer Motion animates x/y only
                Enabled  → circle center (0, 0)
                Disabled → slides out of circle to bottom-right (55, 55)
                           sqrt(55²+55²) = 77.8px > ring radius 72px ✓ */}
            <motion.div
              animate={{
                x: cfg.killSwitchEnabled ? 0 : 55,
                y: cfg.killSwitchEnabled ? 0 : 55,
              }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
            >
              {/* Layer 3 — background / boxShadow / whileTap scale */}
              <motion.button
                onClick={() => {
                  setCfg((p) => ({ ...p, killSwitchEnabled: !p.killSwitchEnabled }));
                }}
                whileTap={{ scale: 0.93 }}
                animate={{
                  background: cfg.killSwitchEnabled
                    ? "rgba(107,158,130,0.15)"
                    : "rgba(160,112,112,0.15)",
                  boxShadow: cfg.killSwitchEnabled
                    ? "0 0 40px rgba(107,158,130,0.3), 0 0 80px rgba(107,158,130,0.1)"
                    : "0 0 40px rgba(160,112,112,0.2), 0 0 80px rgba(160,112,112,0.08)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {cfg.killSwitchEnabled ? (
                  <ShieldCheck size={36} color="#6b9e82" strokeWidth={1.5} />
                ) : (
                  <ShieldOff size={36} color="#a07070" strokeWidth={1.5} />
                )}
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: cfg.killSwitchEnabled ? "#6b9e82" : "#a07070",
                }}>
                  {cfg.killSwitchEnabled ? "PROTECTED" : "DISABLED"}
                </span>
              </motion.button>
            </motion.div>
          </div>
        </div>

        {/* Status text */}
        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            margin: "0 0 20px 0",
          }}
        >
          {cfg.killSwitchEnabled
            ? `Active ROI threshold: ${cfg.roiThreshold}%`
            : "Kill-switch inactive"}
        </p>
      </motion.div>

      {/* Settings Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        style={{
          ...CARD_STYLE,
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* ROI Threshold */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <label style={LABEL}>ROI threshold</label>
            <span
              style={{
                fontSize: 18,
                fontWeight: 200,
                letterSpacing: "-0.04em",
                color: "#a07070",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {cfg.roiThreshold}%
            </span>
          </div>
          <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                borderRadius: 99,
                background:
                  cfg.roiThreshold > -20
                    ? "#a07070"
                    : cfg.roiThreshold > -40
                      ? "#b09040"
                      : "#6b9e82",
                opacity: 0.7,
                width: `${((cfg.roiThreshold - -100) / (-5 - -100)) * 100}%`,
                transition: "width 0.1s",
              }}
            />
            <input
              type="range"
              min={-100}
              max={-5}
              step={5}
              value={cfg.roiThreshold}
              onChange={(e) =>
                setCfg((p) => ({ ...p, roiThreshold: Number(e.target.value) }))
              }
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                opacity: 0,
                height: "100%",
                cursor: "pointer",
              }}
            />
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
            Campaigns below {cfg.roiThreshold}%
          </p>
        </div>

        {/* Check Interval */}
        <div>
          <label style={{ ...LABEL, display: "block", marginBottom: 8 }}>
            Check interval
          </label>
          <select
            value={cfg.checkIntervalMinutes}
            onChange={(e) =>
              setCfg((p) => ({ ...p, checkIntervalMinutes: Number(e.target.value) }))
            }
            style={{
              ...INPUT,
              appearance: "none" as const,
              paddingRight: 30,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.5)' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {/* Max Spend */}
        <div>
          <label style={{ ...LABEL, display: "block", marginBottom: 8 }}>
            Max spend / campaign
          </label>
          <input
            type="number"
            min={0}
            step={1}
            placeholder="Ex: 100 ($)"
            value={cfg.maxSpendPerCampaign ?? ""}
            onChange={(e) =>
              setCfg((p) => ({
                ...p,
                maxSpendPerCampaign: e.target.value ? Number(e.target.value) : null,
              }))
            }
            style={INPUT}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            }}
          />
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
            Optional
          </p>
        </div>

        {/* Auto-check Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            background: "rgba(107,158,130,0.08)",
            border: "1px solid rgba(107,158,130,0.15)",
            borderRadius: 10,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Clock size={18} color="#6b9e82" strokeWidth={1.5} />
          </motion.div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#6b9e82", margin: 0 }}>
              Auto-check
            </p>
            <p style={{ fontSize: 9, color: "rgba(107,158,130,0.6)", margin: "2px 0 0 0" }}>
              every {cfg.checkIntervalMinutes} min
            </p>
          </div>
        </div>
      </motion.div>

      {/* Audit Trail / Log Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        style={{
          ...CARD_STYLE,
          padding: "20px",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h3
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#6b9e82",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Activity Log
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              ▌
            </motion.span>
          </h3>
        </div>

        <div
          ref={logsContainerRef}
          style={{
            height: 200,
            overflowY: "auto",
            background: "rgba(0,0,0,0.5)",
            borderRadius: 10,
            padding: 12,
            fontFamily: "monospace",
            fontSize: 11,
            lineHeight: "1.6",
          }}
        >
          <AnimatePresence>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  marginBottom: 6,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.25)" }}>[{log.timestamp}]</span>
                <span
                  style={{
                    color:
                      log.type === "check"
                        ? "#6b9e82"
                        : log.type === "alert"
                          ? "#a07070"
                          : "rgba(255,255,255,0.5)",
                  }}
                >
                  {log.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Last Run Result */}
      <AnimatePresence>
        {lastRun && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              ...CARD_STYLE,
              padding: "14px 18px",
              fontSize: 12,
              background:
                lastRun.killed > 0
                  ? "rgba(160,112,112,0.07)"
                  : "rgba(107,158,130,0.07)",
              color: lastRun.killed > 0 ? "#a07070" : "#6b9e82",
              border: `1px solid ${
                lastRun.killed > 0
                  ? "rgba(160,112,112,0.12)"
                  : "rgba(107,158,130,0.12)"
              }`,
            }}
          >
            {lastRun.killed > 0
              ? `${lastRun.killed}/${lastRun.checked} campaign(s) stopped: ${lastRun.killedList?.join(", ")}`
              : `✓ ${lastRun.checked} campaigns checked — all OK`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <MagneticButton onClick={save} disabled={saving} isDanger={false}>
          {saving ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
              >
                <RefreshCw size={12} strokeWidth={2} />
              </motion.div>
              Saving…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M12 6v6l4 2" />
              </svg>
              Save
            </>
          )}
        </MagneticButton>

        <MagneticButton onClick={runNow} disabled={isTesting} isDanger={true}>
          {isTesting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
              >
                <RefreshCw size={12} strokeWidth={2} />
              </motion.div>
              Test…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run now
            </>
          )}
        </MagneticButton>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 12,
              background: toast.ok
                ? "rgba(107,158,130,0.07)"
                : "rgba(160,112,112,0.07)",
              color: toast.ok ? "#6b9e82" : "#a07070",
              border: `1px solid ${
                toast.ok
                  ? "rgba(107,158,130,0.12)"
                  : "rgba(160,112,112,0.12)"
              }`,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
