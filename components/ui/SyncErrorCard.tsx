"use client";

import { motion } from "framer-motion";

// ─── Tone palette ─────────────────────────────────────────────────────────────

const TONES = {
  rose:    { card: { border: "rgba(252,165,165,0.18)", bg: "rgba(244,63,94,0.07)"   }, badge: { border: "rgba(252,165,165,0.20)", bg: "rgba(244,63,94,0.09)",   text: "rgba(254,205,211,0.9)" } },
  amber:   { card: { border: "rgba(251,191,36,0.18)",  bg: "rgba(245,158,11,0.07)"  }, badge: { border: "rgba(251,191,36,0.22)",  bg: "rgba(245,158,11,0.10)",  text: "rgba(253,230,138,0.9)" } },
  violet:  { card: { border: "rgba(167,139,250,0.18)", bg: "rgba(139,92,246,0.07)"  }, badge: { border: "rgba(167,139,250,0.20)", bg: "rgba(139,92,246,0.09)",  text: "rgba(221,214,254,0.9)" } },
  sky:     { card: { border: "rgba(56,189,248,0.18)",  bg: "rgba(14,165,233,0.07)"  }, badge: { border: "rgba(56,189,248,0.20)",  bg: "rgba(14,165,233,0.09)",  text: "rgba(186,230,253,0.9)" } },
  emerald: { card: { border: "rgba(52,211,153,0.18)",  bg: "rgba(16,185,129,0.07)"  }, badge: { border: "rgba(52,211,153,0.20)",  bg: "rgba(16,185,129,0.09)",  text: "rgba(167,243,208,0.9)" } },
} as const;

export type SyncErrorTone = keyof typeof TONES;

// ─── Network Disconnected Card ────────────────────────────────────────────────

interface NetworkErrorCardProps {
  networkLabel: string;
  lastSyncLabel?: string;
  description: string;
  tone?: SyncErrorTone;
  onReconnect?: () => void;
  delay?: number;
}

export function NetworkErrorCard({
  networkLabel, lastSyncLabel, description,
  tone = "rose", onReconnect, delay = 0,
}: NetworkErrorCardProps) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 28, padding: 26,
        border: `1px solid ${t.card.border}`, background: t.card.bg,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: "inline-flex", borderRadius: 999,
            border: `1px solid ${t.badge.border}`, background: t.badge.bg,
            padding: "4px 13px", fontSize: 10,
            textTransform: "uppercase", letterSpacing: "0.22em", color: t.badge.text,
          }}>
            Network disconnected
          </div>
          <div style={{
            marginTop: 16, fontSize: 26, letterSpacing: "-0.04em",
            fontWeight: 300, lineHeight: 1.15, color: "rgba(255,255,255,0.92)",
          }}>
            {networkLabel} sync failed. Campaign data may be stale.
          </div>
          <div style={{
            marginTop: 12, fontSize: 13.5, lineHeight: 1.7,
            color: "rgba(255,255,255,0.44)", fontWeight: 300,
          }}>
            {description}
          </div>
        </div>
        {lastSyncLabel && (
          <div style={{
            borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.14)",
            padding: "14px 18px", textAlign: "right", flexShrink: 0, minWidth: 130,
          }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)" }}>
              Last successful sync
            </div>
            <div style={{ marginTop: 6, fontSize: 20, letterSpacing: "-0.04em", fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
              {lastSyncLabel}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onReconnect}
          style={{
            borderRadius: 14, border: "none", background: "#fff", color: "#000",
            padding: "11px 20px", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Reconnect API
        </button>
        <button style={{
          borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)", padding: "11px 16px",
          fontSize: 13.5, color: "rgba(255,255,255,0.65)", cursor: "pointer", fontFamily: "inherit",
        }}>
          View logs
        </button>
      </div>
    </motion.div>
  );
}

// ─── Postback Unhealthy Card ──────────────────────────────────────────────────

interface PostbackHealthCardProps {
  healthPct: number;
  likelyCause: string;
  delay?: number;
}

export function PostbackHealthCard({ healthPct, likelyCause, delay = 0 }: PostbackHealthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 28, padding: 26,
        border: "1px solid rgba(251,191,36,0.18)", background: "rgba(245,158,11,0.07)",
      }}
    >
      <div style={{
        display: "inline-flex", borderRadius: 999,
        border: "1px solid rgba(251,191,36,0.22)", background: "rgba(245,158,11,0.10)",
        padding: "4px 13px", fontSize: 10,
        textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(253,230,138,0.9)",
      }}>
        Postback unhealthy
      </div>
      <div style={{
        marginTop: 16, fontSize: 26, letterSpacing: "-0.04em",
        fontWeight: 300, lineHeight: 1.15, color: "rgba(255,255,255,0.92)",
      }}>
        Revenue signal dropped below healthy threshold.
      </div>
      <div style={{
        marginTop: 12, fontSize: 13.5, lineHeight: 1.7,
        color: "rgba(255,255,255,0.44)", fontWeight: 300,
      }}>
        Conversions may still be happening, but not all postback events are being received. Profit and engine decisions could become less reliable.
      </div>

      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.12)", padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)" }}>Health</div>
          <div style={{ marginTop: 8, fontSize: 28, letterSpacing: "-0.04em", fontWeight: 300, fontVariantNumeric: "tabular-nums", color: "#fbbf24" }}>
            {healthPct}%
          </div>
          <div style={{ marginTop: 8, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ width: `${healthPct}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }} />
          </div>
        </div>
        <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.12)", padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)" }}>Likely cause</div>
          <div style={{ marginTop: 8, fontSize: 15, color: "rgba(255,255,255,0.82)", lineHeight: 1.45, fontWeight: 300 }}>{likelyCause}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Mini Status Card (for the 3-column row) ─────────────────────────────────

interface MiniStatusCardProps {
  tone: SyncErrorTone;
  badge: string;
  title: string;
  text: string;
  /** Optional bottom content (pill, button, etc.) */
  footer?: React.ReactNode;
  delay?: number;
}

export function MiniStatusCard({ tone, badge, title, text, footer, delay = 0 }: MiniStatusCardProps) {
  const t = TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 24, padding: 22,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(17,18,25,0.98), rgba(12,13,19,0.98))",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        minHeight: 170,
      }}
    >
      <div>
        <div style={{
          display: "inline-flex", borderRadius: 999,
          border: `1px solid ${t.badge.border}`, background: t.badge.bg,
          padding: "4px 12px", fontSize: 10,
          textTransform: "uppercase", letterSpacing: "0.22em", color: t.badge.text,
        }}>
          {badge}
        </div>
        <div style={{
          marginTop: 14, fontSize: 20, letterSpacing: "-0.04em",
          fontWeight: 300, lineHeight: 1.25, color: "rgba(255,255,255,0.88)",
        }}>
          {title}
        </div>
        <div style={{
          marginTop: 8, fontSize: 13, lineHeight: 1.65,
          color: "rgba(255,255,255,0.38)", fontWeight: 300,
        }}>
          {text}
        </div>
      </div>
      {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
    </motion.div>
  );
}
