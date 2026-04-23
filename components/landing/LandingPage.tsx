"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useInView,
} from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const BG           = "#05060a";
const BORDER       = "rgba(255,255,255,0.08)";
const BORDER_FAINT = "rgba(255,255,255,0.055)";
const T_PRIMARY    = "rgba(255,255,255,0.92)";
const T_MUTED      = "rgba(255,255,255,0.44)";
const T_DIM        = "rgba(255,255,255,0.24)";
const KILL_COL     = "#f87171";
const TRACK_COL    = "#fbbf24";
const SCALE_COL    = "#4ade80";
const VIOLET       = "#8b5cf6";
const SKY          = "#38bdf8";

const SEC: React.CSSProperties = {
  padding: "120px 48px",
  borderBottom: `1px solid ${BORDER_FAINT}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function Pill({ children, color = "#fb7185" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.03)", padding: "6px 14px",
      fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.22em", color: "rgba(255,255,255,0.52)",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {children}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// HOOK — COUNT-UP (for animated stat numbers)
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, inView: boolean, duration = 1500): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView || target === 0) return;
    let startTime: number | null = null;
    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic — fast at first, slows as it approaches target
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);
  return count;
}

// Logo SVG — violet gradient square with chart line (matches legal pages)
function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="logo-grad-main" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#logo-grad-main)" />
      <path d="M6 15L10 11L13 13L18 7" stroke="#0a0c10" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="7" r="1.6" fill="#0a0c10" />
    </svg>
  );
}

function SignalLine({ id = "sig" }: { id?: string }) {
  return (
    <svg viewBox="0 0 1200 180" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0" />
          <stop offset="15%"  stopColor="#38bdf8" />
          <stop offset="50%"  stopColor="#8b5cf6" />
          <stop offset="85%"  stopColor="#fb7185" />
          <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,110 C90,82 136,140 216,118 C302,94 344,128 428,82 C498,44 570,66 648,100 C732,136 804,76 890,90 C980,104 1036,58 1200,86"
        fill="none" stroke={`url(#${id})`} strokeWidth="3" strokeLinecap="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — HERO
// ─────────────────────────────────────────────────────────────────────────────

type CRow = { id: string; name: string; net: string; roi: string; action: string; t: "scale" | "track" | "kill" };

const INIT_CAMPAIGNS: CRow[] = [
  { id: "c1", name: "Nutra_US_01",  net: "ExoClick",     roi: "+41%", action: "Scale",   t: "scale" },
  { id: "c2", name: "Dating_DE_04", net: "TrafficStars", roi: "-18%", action: "Watch",   t: "track" },
  { id: "c3", name: "Casino_BR_07", net: "TrafficJunky", roi: "+29%", action: "Scale",   t: "scale" },
  { id: "c4", name: "VPN_FR_02",    net: "ExoClick",     roi: "-31%", action: "Killing", t: "kill"  },
];

function rowBadge(t: string): React.CSSProperties {
  if (t === "scale") return { border: "1px solid rgba(74,222,128,0.18)",  background: "rgba(74,222,128,0.08)",  color: "#a7f3d0" };
  if (t === "track") return { border: "1px solid rgba(251,191,36,0.18)", background: "rgba(251,191,36,0.08)", color: "#fde68a" };
  return                    { border: "1px solid rgba(248,113,113,0.18)", background: "rgba(248,113,113,0.08)", color: "#fecaca" };
}

function rowRoi(t: string) {
  if (t === "scale") return "#6ee7b7";
  if (t === "track") return "#fcd34d";
  return "#fca5a5";
}

function HeroSection() {
  const [campaigns, setCampaigns] = useState<CRow[]>(INIT_CAMPAIGNS);
  const [engActions, setEngActions] = useState(3);
  const [savedAmt, setSavedAmt] = useState(134);
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "done" | "already">("idle");

  // Parallax — card drifts down slightly as user scrolls past hero
  const { scrollY } = useScroll();
  const heroCardY = useTransform(scrollY, [0, 700], [0, 38]);

  const handleWaitlist = async () => {
    if (!email.trim() || submitState === "loading" || submitState === "done") return;
    setSubmitState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      setSubmitState(data.already ? "already" : "done");
    } catch {
      setSubmitState("idle");
    }
  };

  useEffect(() => {
    const run = () => {
      const T: ReturnType<typeof setTimeout>[] = [];

      const flash = (msg: string) => {
        setActionFlash(msg);
        T.push(setTimeout(() => setActionFlash(null), 2000));
      };

      // Kill VPN_FR_02
      T.push(setTimeout(() => {
        setCampaigns(c => c.filter(r => r.id !== "c4"));
        setEngActions(n => n + 1);
        setSavedAmt(n => n + 31);
        flash("Killed \u00b7 VPN_FR_02 \u00b7 \u20ac31 saved");
      }, 2000));

      // New campaign enters in Watch
      T.push(setTimeout(() => {
        setCampaigns(c => [
          { id: "c5", name: "Adult_IT_09", net: "TrafficStars", roi: "-22%", action: "Watch", t: "track" },
          ...c,
        ]);
      }, 3600));

      // Flag new campaign for kill
      T.push(setTimeout(() => {
        setCampaigns(c => c.map(r => r.id === "c5" ? { ...r, action: "Killing", t: "kill" as const } : r));
        flash("Flagged \u00b7 Adult_IT_09");
      }, 8000));

      // Kill it
      T.push(setTimeout(() => {
        setCampaigns(c => c.filter(r => r.id !== "c5"));
        setEngActions(n => n + 1);
        setSavedAmt(n => n + 22);
        flash("Killed \u00b7 Adult_IT_09 \u00b7 \u20ac22 saved");
      }, 9800));

      // Scale Casino_BR_07
      T.push(setTimeout(() => {
        setCampaigns(c => c.map(r => r.id === "c3" ? { ...r, roi: "+38%", action: "Scale \u2191" } : r));
        setEngActions(n => n + 1);
        flash("Scaled \u00b7 Casino_BR_07");
      }, 12500));

      // Reset loop
      T.push(setTimeout(() => {
        setCampaigns(INIT_CAMPAIGNS);
        setEngActions(3);
        setSavedAmt(134);
      }, 19500));

      return T;
    };

    let T = run();
    const loop = setInterval(() => { T.forEach(clearTimeout); T = run(); }, 21000);
    return () => { T.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  return (
    <section id="hero" style={{
      position: "relative", minHeight: "100vh", overflow: "hidden",
      borderBottom: `1px solid ${BORDER_FAINT}`,
      background: [
        "radial-gradient(circle at 14% 12%, rgba(220,38,38,0.08), transparent 22%)",
        "radial-gradient(circle at 76% 14%, rgba(255,255,255,0.03), transparent 20%)",
        "radial-gradient(circle at 82% 76%, rgba(255,255,255,0.02), transparent 20%)",
      ].join(","),
    }}>
      {/* Grid overlay */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04,
        background: "linear-gradient(to right, transparent 95%, rgba(255,255,255,0.1) 95%, transparent), linear-gradient(to bottom, transparent 95%, rgba(255,255,255,0.07) 95%, transparent)",
        backgroundSize: "120px 120px",
      }} />

      <div style={{ margin: "0 auto", maxWidth: 1640, padding: "108px 48px 80px", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1.05fr",
          alignItems: "center", gap: 40, minHeight: "84vh",
        }}>

          {/* ── Left copy ── */}
          <div>
            <Pill>Decision engine for media buyers</Pill>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{
                marginTop: 32, maxWidth: "9ch",
                fontSize: 92, fontWeight: 600, lineHeight: 0.88,
                letterSpacing: "-0.08em", color: T_PRIMARY,
              }}
            >
              YOUR<br />CAMPAIGNS<br />
              <span style={{ color: "#f43f5e" }}>ARE LOSING<br />MONEY.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.10, ease: [0.16, 1, 0.3, 1] }}
              style={{
                marginTop: 36, maxWidth: "36ch",
                fontSize: 20, lineHeight: "34px", color: T_MUTED,
              }}
            >
              ProfitDash detects leaking campaigns, reads real profit, and helps you kill, watch, or scale before more budget disappears.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginTop: 44, display: "flex", gap: 14, maxWidth: 680 }}
            >
              {submitState === "done" || submitState === "already" ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    flex: 1, height: 56, borderRadius: 16, display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 10, fontSize: 15,
                    border: "1px solid rgba(99,240,144,0.22)",
                    background: "rgba(99,240,144,0.06)",
                    color: "rgba(99,240,144,0.90)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>✓</span>
                  {submitState === "already" ? "You're already on the list." : "You're on the list — we'll reach out soon."}
                </motion.div>
              ) : (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleWaitlist()}
                    placeholder="Enter your email — claim your spot"
                    style={{
                      flex: 1, height: 56, borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      padding: "0 22px", fontSize: 15,
                      color: T_PRIMARY, outline: "none",
                      fontFamily: "inherit",
                    } as React.CSSProperties}
                  />
                  <button
                    onClick={handleWaitlist}
                    disabled={submitState === "loading"}
                    style={{
                      height: 56, borderRadius: 16,
                      background: submitState === "loading" ? "rgba(255,255,255,0.12)" : "#ffffff",
                      padding: "0 32px", fontSize: 15, fontWeight: 600,
                      color: submitState === "loading" ? "rgba(255,255,255,0.40)" : "#000000",
                      border: "none",
                      cursor: submitState === "loading" ? "default" : "pointer",
                      whiteSpace: "nowrap", transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    {submitState === "loading" ? "Joining..." : "Claim early access \u2192"}
                  </button>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.32 }}
              style={{ marginTop: 24, display: "flex", gap: 28, fontSize: 13, color: "rgba(255,255,255,0.28)" }}
            >
              <span>✓ Free for first 100 users</span>
              <span>✓ No credit card</span>
              <span>✓ 2-minute setup</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.40 }}
              style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.18)" }}
            >
              By joining, you agree to our{" "}
              <a href="/terms" style={{ color: "rgba(255,255,255,0.32)", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.14)" }}>Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" style={{ color: "rgba(255,255,255,0.32)", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.14)" }}>Privacy Policy</a>.
            </motion.p>
          </div>

          {/* ── Right visual ── */}
          <div style={{
            position: "relative", minHeight: 780,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
          }}>
            {/* Signal connector — anchored at hero bottom, bleeds toward SyncStrip */}
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              height: 78, opacity: 0.20,
            }}>
              <SignalLine id="hero-sig" />
            </div>

            {/* Command center card — parallax wrapper + entrance animation */}
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "relative", zIndex: 10, marginTop: 240, width: "100%", maxWidth: 740, y: heroCardY }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "relative",
                  borderRadius: 28,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "linear-gradient(180deg,rgba(15,16,24,0.96),rgba(9,10,16,0.98))",
                  padding: 22,
                  boxShadow: "0 32px 80px rgba(0,0,0,0.44),0 0 0 1px rgba(255,255,255,0.04) inset",
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Action flash notification */}
                <AnimatePresence>
                  {actionFlash && (
                    <motion.div
                      key="flash"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22 }}
                      style={{
                        position: "absolute", top: 14, right: 14, zIndex: 20,
                        borderRadius: 8, background: "rgba(248,113,113,0.12)",
                        border: "1px solid rgba(248,113,113,0.20)",
                        padding: "4px 12px", fontSize: 9,
                        color: "#fecaca", textTransform: "uppercase", letterSpacing: "0.13em",
                      }}
                    >{actionFlash}</motion.div>
                  )}
                </AnimatePresence>

                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingBottom: 16, borderBottom: `1px solid ${BORDER_FAINT}`,
                }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM }}>Decision engine</div>
                    <div style={{ marginTop: 8, fontSize: 26, letterSpacing: "-0.05em", fontWeight: 300 }}>
                      Watching {campaigns.length} campaigns · acting now
                    </div>
                  </div>
                  <motion.div
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{
                      borderRadius: 999, border: "1px solid rgba(248,113,113,0.22)",
                      background: "rgba(239,68,68,0.11)", padding: "4px 14px",
                      fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "#fecaca",
                      display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.0, repeat: Infinity }}
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "#f87171", flexShrink: 0 }}
                    />
                    Live
                  </motion.div>
                </div>

                {/* Stats */}
                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {([
                    ["ROI today",      "-18.4%",            "#fca5a5"],
                    ["Saved today",    `\u20ac${savedAmt}`, "#86efac"],
                    ["Engine actions", `${engActions}`,     "#a5b4fc"],
                  ] as const).map(([label, value, col]) => (
                    <div key={label} style={{
                      borderRadius: 14, border: BORDER,
                      background: "rgba(255,255,255,0.025)", padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>{label}</div>
                      <motion.div
                        key={value}
                        initial={{ opacity: 0.4, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        style={{ marginTop: 10, fontSize: 30, letterSpacing: "-0.05em", color: col, fontWeight: 200, fontVariantNumeric: "tabular-nums" }}
                      >{value}</motion.div>
                    </div>
                  ))}
                </div>

                {/* Live campaign list */}
                <div style={{ marginTop: 14, borderRadius: 20, border: BORDER, background: "rgba(0,0,0,0.12)", overflow: "hidden" }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {campaigns.map(({ id, name, net, roi, action, t }) => (
                      <motion.div
                        key={id}
                        layout
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -32, transition: { duration: 0.26, ease: "easeIn" } }}
                        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          display: "grid", gridTemplateColumns: "1.1fr 0.8fr 0.5fr 0.7fr",
                          alignItems: "center", gap: 10, padding: "11px 16px 11px 14px", fontSize: 13,
                          borderBottom: `1px solid ${BORDER_FAINT}`,
                          background: t === "kill" ? "rgba(239,68,68,0.07)" : undefined,
                        }}
                      >
                        <div style={{ color: t === "kill" ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.70)" }}>{name}</div>
                        <div style={{ color: "rgba(255,255,255,0.28)" }}>{net}</div>
                        <div style={{ color: rowRoi(t), fontVariantNumeric: "tabular-nums" }}>{roi}</div>
                        <div style={{
                          ...rowBadge(t), justifySelf: "end", borderRadius: 8,
                          padding: "3px 10px", fontSize: 10,
                          textTransform: "uppercase", letterSpacing: "0.16em",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {t === "kill" && (
                            <motion.span
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.0, repeat: Infinity }}
                              style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", flexShrink: 0 }}
                            />
                          )}
                          {action}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Activity strip */}
                <div style={{
                  marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER_FAINT}`,
                  display: "flex", gap: 22, fontSize: 10, color: T_DIM,
                  textTransform: "uppercase", letterSpacing: "0.14em",
                }}>
                  <span>{engActions} engine actions today</span>
                  <span style={{ color: "rgba(74,222,128,0.55)" }}>€{savedAmt} saved</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom gradient — visual connector to SyncStrip below */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 160, pointerEvents: "none",
        background: "linear-gradient(to bottom, transparent, rgba(5,6,10,0.78) 68%, rgba(5,6,10,0.97))",
      }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — SIGNAL SYNC STRIP
// ─────────────────────────────────────────────────────────────────────────────

const SYNC_NODES = [
  { label: "ExoClick",       color: "#f59e0b", delay: 0    },
  { label: "TrafficStars",   color: VIOLET,    delay: 0.45 },
  { label: "TrafficJunky",   color: SKY,       delay: 0.9  },
  { label: "PropellerAds",   color: "#fb923c", delay: 1.35 },
  { label: "Adsterra",       color: "#06b6d4", delay: 1.8  },
];

function SyncStrip() {
  return (
    <section style={{ borderBottom: `1px solid ${BORDER_FAINT}`, background: "rgba(255,255,255,0.008)" }}>
      <div style={{ margin: "0 auto", maxWidth: 1640, padding: "20px 48px" }}>
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center",
          justifyContent: "center", gap: 36,
        }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.24em", color: T_DIM }}>
            Supported networks
          </span>
          {SYNC_NODES.map(({ label, color, delay }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 400 }}>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2.8, repeat: Infinity, delay, ease: "easeInOut" }}
                style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: color,
                }}
              />
              {label}
            </div>
          ))}
          <div style={{ height: 28, borderLeft: BORDER }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.22)" }}>5 networks · one operating layer · more coming</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — LOSING CAMPAIGN STICKY (4 PHASES)
// ─────────────────────────────────────────────────────────────────────────────

const LC_PHASES = [
  { n: "01", label: "Leakage",      color: KILL_COL  },
  { n: "02", label: "Detection",    color: TRACK_COL },
  { n: "03", label: "Intervention", color: "#fb923c"  },
  { n: "04", label: "Stabilized",   color: SCALE_COL },
];

function LosingCampaignSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const [phase, setPhase] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if      (v < 0.27) setPhase(0);
    else if (v < 0.53) setPhase(1);
    else if (v < 0.77) setPhase(2);
    else               setPhase(3);
  });

  // Live drifting numbers in phase 0
  const [roiStr,  setRoiStr]  = useState("-14.0%");
  const [leakStr, setLeakStr] = useState("\u20ac42");
  const roiMv  = useTransform(scrollYProgress, [0, 0.28], [-14.0, -38.4]);
  const leakMv = useTransform(scrollYProgress, [0, 0.28], [42, 196]);
  useMotionValueEvent(roiMv,  "change", (v) => setRoiStr(`${v.toFixed(1)}%`));
  useMotionValueEvent(leakMv, "change", (v) => setLeakStr(`\u20ac${Math.round(v)}`));

  // Background tint shift
  const sectionBg = useTransform(
    scrollYProgress,
    [0, 0.27, 0.53, 0.77, 1.0],
    [
      "radial-gradient(circle at 28% 52%, rgba(220,38,38,0.06), transparent 32%)",
      "radial-gradient(circle at 28% 52%, rgba(220,38,38,0.11), transparent 32%)",
      "radial-gradient(circle at 58% 52%, rgba(251,146,60,0.07), transparent 32%)",
      "radial-gradient(circle at 72% 52%, rgba(74,222,128,0.06), transparent 32%)",
      "radial-gradient(circle at 72% 52%, rgba(74,222,128,0.09), transparent 32%)",
    ]
  );

  // Phase layer opacities
  const p0Op = useTransform(scrollYProgress, [0, 0.22, 0.29], [1, 1, 0]);
  const p1Op = useTransform(scrollYProgress, [0.22, 0.31, 0.46, 0.55], [0, 1, 1, 0]);
  const p2Op = useTransform(scrollYProgress, [0.49, 0.58, 0.70, 0.79], [0, 1, 1, 0]);
  const p3Op = useTransform(scrollYProgress, [0.74, 0.84], [0, 1]);

  // Signal line enters in phase 1
  const sigOp = useTransform(scrollYProgress, [0.22, 0.38], [0, 1]);
  const sigY  = useTransform(scrollYProgress, [0.22, 0.38], [16, 0]);

  // ROI color drifts red
  const roiCol = useTransform(
    scrollYProgress,
    [0, 0.12, 0.28],
    ["rgba(255,255,255,0.62)", "rgba(252,165,165,0.82)", "rgba(248,113,113,1.00)"]
  );

  // Violet bridge: pre-echoes EngineReveal as phase 3 stabilizes
  const violetBridgeOp = useTransform(scrollYProgress, [0.82, 1.0], [0, 0.85]);

  const CARD: React.CSSProperties = {
    borderRadius: 28, border: "1px solid rgba(255,255,255,0.09)",
    background: "linear-gradient(180deg,rgba(14,15,22,0.96),rgba(9,10,16,0.98))",
    overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
  };

  const LAYER: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 48px",
  };

  return (
    <div id="how-it-works" ref={ref} style={{ height: "420vh", position: "relative" }}>
      <motion.div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: sectionBg }}>

        {/* Phase label row */}
        <div style={{
          position: "absolute", top: 46, left: 48, right: 48,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 10,
        }}>
          <Pill color={KILL_COL}>Budget leak story</Pill>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {LC_PHASES.map(({ label, n, color }, i) => (
              <div key={n} style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em",
                color: phase === i ? color : "rgba(255,255,255,0.18)",
                transition: "color 0.5s ease",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: phase === i ? color : "rgba(255,255,255,0.14)",
                  boxShadow: phase === i ? `0 0 8px ${color}` : undefined,
                  transition: "background 0.5s ease, box-shadow 0.5s ease",
                }} />
                {n} {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Phase 0: Leakage ── */}
        <motion.div style={{ ...LAYER, opacity: p0Op }}>
          <div style={{ width: "100%", maxWidth: 860 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(248,113,113,0.80)", marginBottom: 28 }}>
              The campaign is losing money
            </div>
            <div style={{ ...CARD, padding: "36px 40px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 30 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>
                    VPN_FR_02 · ExoClick
                  </div>
                  <motion.div style={{ marginTop: 16, fontSize: 76, fontWeight: 200, letterSpacing: "-0.07em", color: roiCol, fontVariantNumeric: "tabular-nums" }}>
                    {roiStr}
                  </motion.div>
                  <div style={{ marginTop: 6, fontSize: 13, color: T_DIM }}>Today ROI — deteriorating</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>Budget leak</div>
                  <div style={{ marginTop: 14, fontSize: 46, fontWeight: 200, letterSpacing: "-0.055em", color: "#fca5a5", fontVariantNumeric: "tabular-nums" }}>
                    {leakStr}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: T_DIM }}>and accelerating</div>
                </div>
              </div>
              <div style={{ height: 1, background: BORDER_FAINT, marginBottom: 22 }} />
              <div style={{ fontSize: 15, lineHeight: "28px", color: "rgba(255,255,255,0.36)", maxWidth: "54ch" }}>
                Budget is draining. The signal is there. But without ProfitDash, the operator does not see it until it is too late.
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Phase 1: Detection ── */}
        <motion.div style={{ ...LAYER, opacity: p1Op }}>
          <div style={{ width: "100%", maxWidth: 860 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(251,191,36,0.80)", marginBottom: 28 }}>
              ProfitDash detects the anomaly
            </div>
            <div style={{ ...CARD, padding: "36px 40px" }}>
              <motion.div style={{ height: 72, marginBottom: 24, opacity: sigOp, y: sigY }}>
                <SignalLine id="detect-sig" />
              </motion.div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>
                    VPN_FR_02 · ExoClick
                  </div>
                  <div style={{ marginTop: 14, fontSize: 54, fontWeight: 200, letterSpacing: "-0.06em", color: "#fca5a5", fontVariantNumeric: "tabular-nums" }}>-38.4%</div>
                </div>
                <motion.div
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  style={{
                    borderRadius: 999, border: "1px solid rgba(251,191,36,0.22)",
                    background: "rgba(251,191,36,0.09)", padding: "9px 20px",
                    fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "#fde68a",
                  }}
                >
                  ● Watching
                </motion.div>
              </div>
              <div style={{ height: 1, background: BORDER_FAINT, marginBottom: 22 }} />
              <div style={{ fontSize: 15, lineHeight: "28px", color: "rgba(255,255,255,0.36)", maxWidth: "54ch" }}>
                ProfitDash reads the pattern across all connected networks. ROI below threshold. Confidence confirmed. The campaign is flagged for immediate action.
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Phase 2: Intervention ── */}
        <motion.div style={{ ...LAYER, opacity: p2Op }}>
          <div style={{ width: "100%", maxWidth: 860 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(251,146,60,0.80)", marginBottom: 28 }}>
              The system intervenes
            </div>
            <div style={{ ...CARD, padding: "36px 40px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, alignItems: "center", marginBottom: 28 }}>
                <div style={{
                  borderRadius: 20, border: "1px solid rgba(248,113,113,0.18)",
                  background: "rgba(239,68,68,0.06)", padding: "22px 24px",
                }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(252,202,202,0.75)" }}>Before</div>
                  <div style={{ marginTop: 14, fontSize: 40, fontWeight: 200, color: "#fca5a5", letterSpacing: "-0.055em", fontVariantNumeric: "tabular-nums" }}>-38.4%</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: T_DIM }}>Budget draining</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{ fontSize: 26, color: "rgba(255,255,255,0.18)" }}
                  >→</motion.div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: T_DIM }}>Kill</div>
                </div>
                <div style={{
                  borderRadius: 20, border: "1px solid rgba(74,222,128,0.18)",
                  background: "rgba(74,222,128,0.06)", padding: "22px 24px",
                }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(167,243,208,0.75)" }}>After</div>
                  <div style={{ marginTop: 14, fontSize: 40, fontWeight: 200, color: "#86efac", letterSpacing: "-0.055em" }}>Protected</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: T_DIM }}>Damage stopped</div>
                </div>
              </div>
              <div style={{ height: 1, background: BORDER_FAINT, marginBottom: 22 }} />
              <div style={{ fontSize: 15, lineHeight: "28px", color: "rgba(255,255,255,0.36)", maxWidth: "54ch" }}>
                Campaign paused in under 60 seconds. The leak stops. Budget is protected before more damage compounds.
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Phase 3: Stabilized ── */}
        <motion.div style={{ ...LAYER, opacity: p3Op }}>
          <div style={{ width: "100%", maxWidth: 860 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(74,222,128,0.80)", marginBottom: 28 }}>
              Control restored
            </div>
            <div style={{ ...CARD, padding: "36px 40px" }}>
              <div style={{ marginBottom: 30 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>System state</div>
                <div style={{ marginTop: 18, fontSize: 48, fontWeight: 200, letterSpacing: "-0.055em", color: "#86efac" }}>
                  Cleaner. Calmer. Controlled.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
                {[
                  { label: "Budget protected", value: "\u20ac196",  col: "#86efac" },
                  { label: "Kill latency",     value: "< 60s", col: T_PRIMARY },
                  { label: "Active campaigns", value: "3",     col: "#a5b4fc" },
                ].map(({ label, value, col }) => (
                  <div key={label} style={{
                    borderRadius: 16, border: BORDER,
                    background: "rgba(255,255,255,0.025)", padding: "16px 18px",
                  }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>{label}</div>
                    <div style={{ marginTop: 10, fontSize: 28, fontWeight: 200, letterSpacing: "-0.04em", color: col, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: BORDER_FAINT, marginBottom: 22 }} />
              <div style={{ fontSize: 15, lineHeight: "28px", color: "rgba(255,255,255,0.36)", maxWidth: "54ch" }}>
                Budget recovered. Damage stopped before it compounds. This is what the engine does on every campaign it watches.
              </div>
            </div>
          </div>
        </motion.div>

        {/* Violet bridge — pre-echoes EngineReveal as phase 3 resolves */}
        <motion.div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "38%", pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.10), transparent 55%)",
          opacity: violetBridgeOp,
        }} />

        {/* Progress dots */}
        <div style={{
          position: "absolute", bottom: 38, left: 48, right: 48,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 11, color: T_DIM, letterSpacing: "0.14em" }}>Scroll to follow</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: phase === i ? 24 : 6, height: 6, borderRadius: 999,
                background: phase === i ? LC_PHASES[i].color : "rgba(255,255,255,0.14)",
                transition: "width 0.4s ease, background 0.4s ease",
              }} />
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — ENGINE REVEAL: ONE CARD MORPHING INTO THREE (5 PHASES)
// ─────────────────────────────────────────────────────────────────────────────

const ENG_PHASES = [
  { n: "01", label: "Unified engine",  desc: "One system. Three possible outcomes for every campaign.",          color: "rgba(167,139,250,0.80)" },
  { n: "02", label: "Kill",            desc: "Campaigns below threshold are cut before budget compounds.",       color: "rgba(248,113,113,0.80)" },
  { n: "03", label: "Track",           desc: "Signals read across all networks. Real profit, not estimates.",    color: "rgba(251,191,36,0.80)"  },
  { n: "04", label: "Scale",           desc: "When a campaign earns it, the engine tells you when to push.",    color: "rgba(74,222,128,0.80)"  },
  { n: "05", label: "The full system", desc: "Kill, Track, and Scale — three decision states, one engine.",     color: "rgba(167,139,250,0.80)" },
];

function EngineRevealSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const [engPhase, setEngPhase] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if      (v < 0.18) setEngPhase(0);
    else if (v < 0.36) setEngPhase(1);
    else if (v < 0.54) setEngPhase(2);
    else if (v < 0.72) setEngPhase(3);
    else               setEngPhase(4);
  });

  // Card shell color morphing
  const borderColor = useTransform(scrollYProgress,
    [0, 0.14, 0.20, 0.32, 0.38, 0.50, 0.56, 0.68, 0.74],
    ["rgba(255,255,255,0.10)","rgba(255,255,255,0.10)",
     "rgba(248,113,113,0.38)","rgba(248,113,113,0.38)",
     "rgba(251,191,36,0.38)", "rgba(251,191,36,0.38)",
     "rgba(74,222,128,0.38)", "rgba(74,222,128,0.38)",
     "rgba(255,255,255,0.10)"]
  );
  const cardBg = useTransform(scrollYProgress,
    [0, 0.14, 0.20, 0.32, 0.38, 0.50, 0.56, 0.68, 0.74],
    ["rgba(14,15,22,0.97)","rgba(14,15,22,0.97)",
     "rgba(28,10,10,0.97)","rgba(28,10,10,0.97)",
     "rgba(26,20,4,0.97)", "rgba(26,20,4,0.97)",
     "rgba(6,22,12,0.97)", "rgba(6,22,12,0.97)",
     "rgba(14,15,22,0.97)"]
  );

  // Content layer opacities
  const unifiedOp = useTransform(scrollYProgress, [0, 0.14, 0.20], [1, 1, 0]);
  const killOp    = useTransform(scrollYProgress, [0.16, 0.24, 0.30, 0.38], [0, 1, 1, 0]);
  const trackOp   = useTransform(scrollYProgress, [0.34, 0.42, 0.48, 0.56], [0, 1, 1, 0]);
  const scaleOp   = useTransform(scrollYProgress, [0.52, 0.60, 0.66, 0.74], [0, 1, 1, 0]);

  // Morph card fades out before split
  const morphOp   = useTransform(scrollYProgress, [0.70, 0.78], [1, 0]);

  // Split cards
  const splitOp   = useTransform(scrollYProgress, [0.74, 0.82], [0, 1]);
  const killX     = useTransform(scrollYProgress, [0.74, 0.92], [-120, 0]);
  const scaleX    = useTransform(scrollYProgress, [0.74, 0.92], [120, 0]);
  const killOp2   = useTransform(scrollYProgress, [0.74, 0.84], [0, 1]);
  const trackOp2  = useTransform(scrollYProgress, [0.77, 0.86], [0, 1]);
  const scaleOp2  = useTransform(scrollYProgress, [0.80, 0.88], [0, 1]);
  const splitSc   = useTransform(scrollYProgress, [0.74, 0.88], [0.95, 1]);
  // Green bridge: inherits resolved state from LosingCampaign
  const greenBridgeOp = useTransform(scrollYProgress, [0, 0.09], [1, 0]);

  // Background tint
  const tint = useTransform(scrollYProgress,
    [0, 0.20, 0.38, 0.56, 0.74, 1.0],
    ["rgba(99,102,241,0.04)","rgba(239,68,68,0.04)","rgba(245,158,11,0.04)",
     "rgba(74,222,128,0.04)","rgba(99,102,241,0.04)","rgba(99,102,241,0.06)"]
  );

  const CW = 620; const CH = 448;
  const SW = 192;

  const CLAYER: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    padding: "36px 40px", display: "flex", flexDirection: "column",
  };

  return (
    <div id="the-system" ref={ref} style={{ height: "540vh", position: "relative" }}>
      <motion.div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: tint }}>

        {/* Green bridge — inherits resolved green from LosingCampaign section */}
        <motion.div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: "45%", pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 0%, rgba(74,222,128,0.06), transparent 55%)",
          opacity: greenBridgeOp,
        }} />

        {/* Phase dots — top */}
        <div style={{
          position: "absolute", top: 46, left: 48, right: 48,
          display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10,
        }}>
          <Pill color={VIOLET}>Decision Engine</Pill>
          <div style={{ display: "flex", gap: 10 }}>
            {ENG_PHASES.map(({ n }, i) => (
              <div key={n} style={{
                width: engPhase === i ? 28 : 7, height: 7, borderRadius: 999,
                background: engPhase === i ? ENG_PHASES[i].color : "rgba(255,255,255,0.12)",
                transition: "width 0.5s ease, background 0.5s ease",
              }} />
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "grid", gridTemplateColumns: "1fr 1.7fr",
          alignItems: "center", padding: "96px 48px 80px",
          gap: 48,
        }}>

          {/* Left: narrative */}
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM, marginBottom: 20 }}>
              One engine
            </div>
            <h2 style={{
              fontSize: 52, fontWeight: 600, lineHeight: 0.93,
              letterSpacing: "-0.065em", color: T_PRIMARY, marginBottom: 32,
            }}>
              One engine.<br />Three outcomes.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ENG_PHASES.map(({ n, label, desc, color }, i) => (
                <div key={n} style={{
                  display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px",
                  borderRadius: 16,
                  border: `1px solid ${engPhase === i ? "rgba(255,255,255,0.08)" : "transparent"}`,
                  background: engPhase === i ? "rgba(255,255,255,0.025)" : "transparent",
                  opacity: engPhase === i ? 1 : 0.22,
                  transition: "opacity 0.5s ease, border-color 0.5s ease, background 0.5s ease",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    border: `1px solid ${engPhase === i ? color : "rgba(255,255,255,0.12)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600,
                    color: engPhase === i ? color : T_DIM,
                    transition: "color 0.5s ease, border-color 0.5s ease",
                  }}>{n}</div>
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                      letterSpacing: "0.14em", marginBottom: 4,
                      color: engPhase === i ? color : T_DIM,
                      transition: "color 0.5s ease",
                    }}>{label}</div>
                    <div style={{ fontSize: 12, lineHeight: "20px", color: "rgba(255,255,255,0.40)" }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: morphing card + split */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: CW, height: CH }}>

              {/* Morph card shell */}
              <motion.div style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 28, border: "1px solid", borderColor, background: cardBg,
                boxShadow: "0 28px 80px rgba(0,0,0,0.44)",
                overflow: "hidden", opacity: morphOp,
              }}>
                {/* Unified */}
                <motion.div style={{ ...CLAYER, opacity: unifiedOp }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(167,139,250,0.70)", marginBottom: 18 }}>Decision Engine</div>
                  <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.05em", marginBottom: 28 }}>One engine.<br />Three outcomes.</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
                      {([
                        { col: KILL_COL,  label: "Kill",  desc: "Stop the loss" },
                        { col: TRACK_COL, label: "Track", desc: "Read the signal" },
                        { col: SCALE_COL, label: "Scale", desc: "Push budget" },
                      ] as const).map(({ col, label, desc }, idx) => (
                        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                          <motion.div
                            animate={{ boxShadow: [`0 0 0px ${col}00`, `0 0 28px ${col}30`, `0 0 0px ${col}00`] }}
                            transition={{ duration: 2.8, repeat: Infinity, delay: idx * 0.9, ease: "easeInOut" }}
                            style={{
                              width: 90, height: 90, borderRadius: "50%",
                              border: `1px solid ${col}36`, background: `${col}0e`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: col, opacity: 0.70 }} />
                          </motion.div>
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: `${col}bb`, textAlign: "center" }}>{label}</div>
                          <div style={{ fontSize: 10, color: T_DIM, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center" }}>{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: T_DIM, lineHeight: "22px" }}>
                    Every campaign is read continuously. The engine assigns a state — and acts within seconds.
                  </div>
                </motion.div>

                {/* Kill */}
                <motion.div style={{ ...CLAYER, opacity: killOp }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(248,113,113,0.80)", marginBottom: 18 }}>Kill</div>
                  <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.05em", marginBottom: 28 }}>Stop the loss.<br />Instantly.</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 64, fontWeight: 200, letterSpacing: "-0.07em", color: KILL_COL, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>&lt; 60s</div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>Kill latency</div>
                  </div>
                  <div style={{ fontSize: 13, color: T_DIM, lineHeight: "22px" }}>
                    Campaigns under threshold are cut before they compound into deeper losses.
                  </div>
                </motion.div>

                {/* Track */}
                <motion.div style={{ ...CLAYER, opacity: trackOp }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(251,191,36,0.80)", marginBottom: 18 }}>Track</div>
                  <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.05em", marginBottom: 28 }}>See real profit,<br />not estimates.</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 64, fontWeight: 200, letterSpacing: "-0.07em", color: TRACK_COL, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>5 nets</div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>Ad networks, one signal layer</div>
                    {/* Signal line: revenue reading across networks — its job here */}
                    <div style={{ height: 44, marginTop: 20, opacity: 0.34 }}>
                      <SignalLine id="track-sig" />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: T_DIM, lineHeight: "22px" }}>
                    Revenue signals unified across all your traffic networks, in real time.
                  </div>
                </motion.div>

                {/* Scale */}
                <motion.div style={{ ...CLAYER, opacity: scaleOp }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.24em", color: "rgba(74,222,128,0.80)", marginBottom: 18 }}>Scale</div>
                  <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.05em", marginBottom: 28 }}>Push budget<br />where it works.</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 64, fontWeight: 200, letterSpacing: "-0.07em", color: SCALE_COL, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>+34%</div>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: T_DIM }}>Average ROI lift</div>
                  </div>
                  <div style={{ fontSize: 13, color: T_DIM, lineHeight: "22px" }}>
                    When a campaign earns it, ProfitDash tells you exactly when and how hard to push.
                  </div>
                </motion.div>
              </motion.div>

              {/* Split: three cards spreading from center */}
              <motion.div style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 16,
              }}>
                <motion.div style={{ x: killX, scale: splitSc, width: SW, flexShrink: 0, opacity: killOp2 }}>
                  <div style={{
                    borderRadius: 24, border: "1px solid rgba(248,113,113,0.24)",
                    background: "rgba(28,10,10,0.97)", padding: "28px 24px",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.38)",
                  }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(248,113,113,0.70)", marginBottom: 22 }}>Kill</div>
                    <div style={{ fontSize: 38, fontWeight: 200, color: KILL_COL, letterSpacing: "-0.055em", marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>&lt; 60s</div>
                    <div style={{ fontSize: 12, color: T_DIM, lineHeight: "20px" }}>Stop the loss instantly</div>
                  </div>
                </motion.div>
                <motion.div style={{ scale: splitSc, width: SW, flexShrink: 0, opacity: trackOp2 }}>
                  <div style={{
                    borderRadius: 24, border: "1px solid rgba(251,191,36,0.24)",
                    background: "rgba(26,20,4,0.97)", padding: "28px 24px",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.38)",
                  }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(251,191,36,0.70)", marginBottom: 22 }}>Track</div>
                    <div style={{ fontSize: 38, fontWeight: 200, color: TRACK_COL, letterSpacing: "-0.055em", marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>5 nets</div>
                    <div style={{ fontSize: 12, color: T_DIM, lineHeight: "20px" }}>See real profit</div>
                  </div>
                </motion.div>
                <motion.div style={{ x: scaleX, scale: splitSc, width: SW, flexShrink: 0, opacity: scaleOp2 }}>
                  <div style={{
                    borderRadius: 24, border: "1px solid rgba(74,222,128,0.24)",
                    background: "rgba(6,22,12,0.97)", padding: "28px 24px",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.38)",
                  }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(74,222,128,0.70)", marginBottom: 22 }}>Scale</div>
                    <div style={{ fontSize: 38, fontWeight: 200, color: SCALE_COL, letterSpacing: "-0.055em", marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>+34%</div>
                    <div style={{ fontSize: 12, color: T_DIM, lineHeight: "20px" }}>Push budget further</div>
                  </div>
                </motion.div>
              </motion.div>

            </div>
          </div>
        </div>

        {/* Bottom fade — softens exit toward SetupSection */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 100, pointerEvents: "none",
          background: "linear-gradient(to bottom, transparent, rgba(5,6,10,0.60))",
        }} />

        {/* Bottom progress */}
        <div style={{
          position: "absolute", bottom: 38, right: 48,
          display: "flex", gap: 8,
        }}>
          {ENG_PHASES.map(({ n }, i) => (
            <div key={n} style={{
              width: engPhase === i ? 24 : 6, height: 6, borderRadius: 999,
              background: engPhase === i ? ENG_PHASES[i].color : "rgba(255,255,255,0.12)",
              transition: "width 0.4s ease, background 0.4s ease",
            }} />
          ))}
        </div>

      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — SETUP / ACTIVATION
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Connect traffic",    body: "ExoClick, TrafficStars, TrafficJunky — all synced into one operating layer.",                    color: SKY       },
  { n: "02", title: "Set your rules",     body: "Kill threshold, watch conditions, and scale logic — configured once, active forever.",           color: VIOLET    },
  { n: "03", title: "Let the engine run", body: "The machine stays on. You react less. The system reacts faster.",                                 color: SCALE_COL },
];

function SetupSection() {
  return (
    <section style={{
      ...SEC,
      background: [
        "radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.07), transparent 20%)",
        "radial-gradient(ellipse at 28% 0%, rgba(74,222,128,0.035), transparent 16%)",
      ].join(","),
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1560 }}>
        <Pill color={SCALE_COL}>Activation</Pill>
        <h2 style={{
          marginTop: 28, fontSize: 76, fontWeight: 600, lineHeight: 0.93,
          letterSpacing: "-0.065em", color: T_PRIMARY, maxWidth: "10ch",
        }}>
          Set rules.<br />Print profit.
        </h2>
        <p style={{ marginTop: 20, maxWidth: "32ch", fontSize: 19, lineHeight: "32px", color: T_MUTED }}>
          Connecting takes two minutes. From there, the engine runs. You operate less. Your operation earns more.
        </p>

        <div style={{
          marginTop: 56, borderRadius: 28, border: BORDER, overflow: "hidden",
          display: "grid", gridTemplateColumns: "repeat(3,1fr)",
        }}>
          {STEPS.map(({ n, title, body, color }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: "40px 36px", minHeight: 320,
                borderRight: i < 2 ? BORDER : undefined,
                background: i === 2 ? "rgba(74,222,128,0.025)" : "transparent",
              }}
            >
              <div style={{ fontSize: 64, fontWeight: 200, letterSpacing: "-0.07em", color: `${color}22`, marginBottom: 24 }}>{n}</div>
              <div style={{ width: 36, height: 2, background: color, opacity: 0.5, borderRadius: 999, marginBottom: 24 }} />
              <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.04em", color: T_PRIMARY, marginBottom: 16 }}>{title}</div>
              <div style={{ fontSize: 15, lineHeight: "28px", color: "rgba(255,255,255,0.38)", maxWidth: "26ch" }}>{body}</div>
            </motion.div>
          ))}
        </div>

        {/* Signal thread */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: 1, marginTop: -1,
            background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)",
            transformOrigin: "left",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 18 }}
        >
          <a href="/register" style={{ textDecoration: "none" }}>
            <button style={{
              height: 52, borderRadius: 14,
              background: "#ffffff", padding: "0 30px",
              fontSize: 14, fontWeight: 600, color: "#000000",
              border: "none", cursor: "pointer",
            }}>Start your 2-minute setup →</button>
          </a>
          <span style={{ fontSize: 13, color: T_DIM }}>No credit card · connects in minutes</span>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — PRODUCT SYSTEM PEEK
// ─────────────────────────────────────────────────────────────────────────────

function ProductPeekSection() {
  const CARD_WRAP: React.CSSProperties = {
    borderRadius: 24, border: BORDER,
    background: "linear-gradient(180deg,rgba(14,15,22,0.95),rgba(9,10,16,0.98))",
    padding: "24px 22px",
    boxShadow: "0 16px 48px rgba(0,0,0,0.20)",
  };
  const FRAG: React.CSSProperties = {
    marginTop: 18, height: 158, borderRadius: 14,
    background: "rgba(9,10,16,0.96)",
    padding: "12px 14px", overflow: "hidden",
  };
  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM };
  const SUBTITLE: React.CSSProperties = { marginTop: 18, fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: T_PRIMARY };

  return (
    <section style={{
      ...SEC,
      background: [
        "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.10), transparent 18%)",
        "radial-gradient(circle at 50% 8%, rgba(99,102,241,0.05), transparent 30%)",
      ].join(","),
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1560 }}>
        <Pill color={VIOLET}>One operating layer</Pill>
        <h2 style={{
          marginTop: 28, fontSize: 72, fontWeight: 600, lineHeight: 0.93,
          letterSpacing: "-0.065em", color: T_PRIMARY, maxWidth: "13ch",
        }}>
          Not one dashboard. One operating layer.
        </h2>

        <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>

          {/* ── Dashboard ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={CARD_WRAP}>
            <div style={LABEL}>Dashboard</div>
            <div style={{ ...FRAG, border: "1px solid rgba(139,92,246,0.14)" }}>
              {/* KPI strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 11 }}>
                {([["ROI", "+31%", "#86efac"], ["Budget", "\u20ac1.2k", T_PRIMARY], ["Active", "4", "#a5b4fc"]] as const).map(([l, v, c]) => (
                  <div key={l} style={{ borderRadius: 7, background: "rgba(255,255,255,0.04)", padding: "5px 7px" }}>
                    <div style={{ fontSize: 7, color: T_DIM, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 200, color: c, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Campaign list */}
              {([["Nutra_US_01", "scale"], ["Dating_DE_04", "track"], ["VPN_FR_02", "kill"]] as const).map(([n, t]) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${BORDER_FAINT}` }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.44)" }}>{n}</div>
                  <div style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 6px", borderRadius: 4, color: t === "scale" ? "#86efac" : t === "track" ? "#fde68a" : "#fecaca", background: t === "scale" ? "rgba(74,222,128,0.09)" : t === "track" ? "rgba(251,191,36,0.09)" : "rgba(248,113,113,0.09)" }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={SUBTITLE}>Live operating view</div>
          </motion.div>

          {/* ── Transactions ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={CARD_WRAP}>
            <div style={LABEL}>Transactions</div>
            <div style={{ ...FRAG, border: "1px solid rgba(56,189,248,0.14)" }}>
              <div style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.18em", color: T_DIM, marginBottom: 10 }}>Revenue postbacks</div>
              {([
                ["14:32", "ExoClick",     "\u20ac2.40"],
                ["14:28", "TrafficStars", "\u20ac1.80"],
                ["14:19", "TrafficJunky", "\u20ac0.60"],
                ["14:07", "ExoClick",     "\u2013"    ],
                ["13:55", "TrafficStars", "\u20ac3.20"],
              ] as const).map(([t, net, amt], i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${BORDER_FAINT}` }}>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.26)", fontVariantNumeric: "tabular-nums" }}>{t}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.40)" }}>{net}</div>
                  <div style={{ fontSize: 9, color: amt === "\u2013" ? "rgba(255,255,255,0.20)" : "#86efac", fontVariantNumeric: "tabular-nums" }}>{amt}</div>
                </div>
              ))}
            </div>
            <div style={SUBTITLE}>Revenue signal</div>
          </motion.div>

          {/* ── Rules ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={CARD_WRAP}>
            <div style={LABEL}>Rules</div>
            <div style={{ ...FRAG, border: "1px solid rgba(251,191,36,0.14)" }}>
              {([
                ["Kill",  "ROI < \u221215%",         "#f87171", "rgba(248,113,113,0.07)"],
                ["Watch", "\u221215% \u2264 ROI < 0", "#fbbf24", "rgba(251,191,36,0.07)" ],
                ["Scale", "ROI > +20%",              "#4ade80", "rgba(74,222,128,0.07)" ],
              ] as const).map(([action, cond, col, bg]) => (
                <div key={action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 8, background: bg, border: `1px solid ${col}18`, padding: "8px 10px", marginBottom: 8 }}>
                  <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: col, fontWeight: 600 }}>{action}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", fontFamily: "ui-monospace, monospace" }}>{cond}</div>
                </div>
              ))}
              <div style={{ paddingTop: 4, fontSize: 7, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
                Active · Watching 4 campaigns
              </div>
            </div>
            <div style={SUBTITLE}>Decision logic</div>
          </motion.div>

          {/* ── Campaign detail ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={CARD_WRAP}>
            <div style={LABEL}>Campaign detail</div>
            <div style={{ ...FRAG, border: "1px solid rgba(74,222,128,0.14)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 8, color: T_DIM, marginBottom: 3 }}>Nutra_US_01</div>
                  <div style={{ fontSize: 11, color: "#86efac", fontWeight: 300 }}>Scale recommended</div>
                </div>
                <div style={{ borderRadius: 6, background: "rgba(74,222,128,0.09)", border: "1px solid rgba(74,222,128,0.18)", padding: "2px 8px", fontSize: 7, textTransform: "uppercase", letterSpacing: "0.14em", color: "#4ade80" }}>
                  &#x25CF; Live
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
                {([["ROI", "+41%"], ["Spend", "\u20ac340"], ["Revenue", "\u20ac480"]] as const).map(([l, v]) => (
                  <div key={l} style={{ borderRadius: 7, background: "rgba(255,255,255,0.035)", padding: "5px 7px" }}>
                    <div style={{ fontSize: 7, color: T_DIM, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 11, color: T_PRIMARY, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  </div>
                ))}
              </div>
              <button style={{ width: "100%", borderRadius: 7, border: "1px solid rgba(74,222,128,0.18)", background: "rgba(74,222,128,0.06)", padding: "6px 0", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: "#86efac", cursor: "pointer" }}>
                Push budget &#x2192;
              </button>
            </div>
            <div style={SUBTITLE}>Execution control</div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — ENGINE IN NUMBERS
// ─────────────────────────────────────────────────────────────────────────────

const ENGINE_STATS = [
  { animTarget: 60,  animFormat: (v: number) => `< ${v}s`, label: "Kill latency",        desc: "From detection to campaign pause. Budget stops draining in under a minute.",                   col: KILL_COL  },
  { animTarget: 24,  animFormat: (v: number) => `${v} / 7`,label: "Engine uptime",        desc: "Automation runs server-side. The engine works even when the dashboard is closed.",             col: VIOLET    },
  { animTarget: 34,  animFormat: (v: number) => `+${v}%`,  label: "Avg ROI lift on scale",desc: "Average performance improvement on campaigns flagged and scaled by the engine.",               col: SCALE_COL },
  { animTarget: 5,   animFormat: (v: number) => `${v}`,    label: "Networks connected",   desc: "ExoClick, TrafficStars, TrafficJunky, PropellerAds, Adsterra — unified in one signal layer.",  col: SKY       },
  { animTarget: 0,   animFormat: () => `€0`,               label: "Cost to start",        desc: "Observer plan is free forever. See real profit and detect leaks before committing a cent.",    col: "rgba(255,255,255,0.55)" },
  { animTarget: 3,   animFormat: (v: number) => `${v}`,    label: "Decision states",      desc: "Kill, Watch, Scale — every campaign is continuously evaluated and assigned a state.",          col: TRACK_COL },
];

// Individual stat cell with count-up on first viewport entry
function StatCell({ animTarget, animFormat, label, desc, col, borderRight, borderBottom }: {
  animTarget: number; animFormat: (v: number) => string;
  label: string; desc: string; col: string;
  borderRight?: boolean; borderBottom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });
  const count = useCountUp(animTarget, inView, 1400);
  const displayValue = animTarget === 0 ? animFormat(0) : animFormat(count);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: "52px 44px",
        borderRight: borderRight ? `1px solid ${BORDER_FAINT}` : undefined,
        borderBottom: borderBottom ? `1px solid ${BORDER_FAINT}` : undefined,
        background: "rgba(255,255,255,0.01)",
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(circle at 20% 30%, ${col}09, transparent 55%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        fontSize: 76, fontWeight: 200, letterSpacing: "-0.065em",
        color: col, lineHeight: 1, fontVariantNumeric: "tabular-nums",
        position: "relative",
      }}>{displayValue}</div>
      <div style={{
        marginTop: 14, fontSize: 10, textTransform: "uppercase",
        letterSpacing: "0.22em", color: "rgba(255,255,255,0.44)",
      }}>{label}</div>
      <div style={{
        marginTop: 10, fontSize: 14, lineHeight: "24px",
        color: T_DIM, maxWidth: "28ch", position: "relative",
      }}>{desc}</div>
    </motion.div>
  );
}

function StatsSection() {
  return (
    <section id="results" style={SEC}>
      <div style={{ margin: "0 auto", maxWidth: 1560 }}>
        <Pill color={VIOLET}>Engine performance</Pill>
        <h2 style={{
          marginTop: 28, fontSize: 68, fontWeight: 600, lineHeight: 0.93,
          letterSpacing: "-0.065em", color: T_PRIMARY, maxWidth: "14ch",
        }}>
          Numbers that matter to operators.
        </h2>

        <div style={{
          marginTop: 56,
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          border: `1px solid ${BORDER_FAINT}`, borderRadius: 28, overflow: "hidden",
        }}>
          {ENGINE_STATS.map(({ animTarget, animFormat, label, desc, col }, i) => (
            <StatCell
              key={label}
              animTarget={animTarget}
              animFormat={animFormat}
              label={label}
              desc={desc}
              col={col}
              borderRight={i % 3 !== 2}
              borderBottom={i < 3}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — PRICING
// ─────────────────────────────────────────────────────────────────────────────

const VI        = "#7c3aed";   // violet-600 — solid, no glow
const VI_BG     = "rgba(124,58,237,0.07)";
const VI_BORDER = "rgba(124,58,237,0.30)";
const VI_LIGHT  = "#c4b5fd";

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  const PRICES = {
    operator: { monthly: 99,  annual: 79  },
    dominion: { monthly: 249, annual: 199 },
  };

  const p = (plan: keyof typeof PRICES) =>
    annual ? PRICES[plan].annual : PRICES[plan].monthly;

  const FEAT = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
      <span style={{ color: SCALE_COL, fontSize: 11, marginTop: 2, flexShrink: 0 }}>✓</span>
      <span style={{ fontSize: 13, lineHeight: "20px", color: "rgba(255,255,255,0.50)" }}>{children}</span>
    </div>
  );

  const CtxBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER_FAINT}`,
      borderRadius: 12, padding: "13px 15px", marginBottom: 18,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.68)", marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: "21px", color: T_MUTED }}>{children}</div>
    </div>
  );

  const B = ({ children }: { children: React.ReactNode }) => (
    <b style={{ color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{children}</b>
  );

  return (
    <section id="pricing" style={SEC}>
      <div style={{ margin: "0 auto", maxWidth: 1100 }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Pill color={VIOLET}>Pricing</Pill>
          <h2 style={{
            marginTop: 24, fontSize: 52, fontWeight: 600, lineHeight: 1.0,
            letterSpacing: "-0.055em", color: T_PRIMARY,
          }}>
            Pick your level of control.
          </h2>
          <p style={{ marginTop: 14, fontSize: 16, lineHeight: "26px", color: T_MUTED }}>
            Start free. Upgrade when your campaigns demand it.
          </p>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 13, color: annual ? T_MUTED : T_PRIMARY, transition: "color 0.2s" }}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              style={{
                position: "relative", width: 44, height: 24, borderRadius: 12,
                background: annual ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, left: annual ? 23 : 3,
                width: 16, height: 16, borderRadius: "50%", background: "#ffffff",
                transition: "left 0.2s cubic-bezier(0.23,1,0.32,1)", display: "block",
              }} />
            </button>
            <span style={{ fontSize: 13, color: annual ? T_PRIMARY : T_MUTED, transition: "color 0.2s" }}>Annual</span>
            {annual && (
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                color: SCALE_COL, background: "rgba(74,222,128,0.10)",
                border: "1px solid rgba(74,222,128,0.18)", borderRadius: 6, padding: "2px 8px",
              }}>2 months free</span>
            )}
          </div>
        </div>

        {/* ── Reassurance strip (above cards) ── */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px 28px", marginBottom: 28 }}>
          {["No credit card on free", "Upgrade or downgrade anytime", "Keep your data when switching", "Onboarding included on Dominion"].map((item) => (
            <span key={item} style={{ fontSize: 12, color: "rgba(255,255,255,0.26)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: SCALE_COL, fontSize: 9 }}>✓</span>{item}
            </span>
          ))}
        </div>

        {/* ── Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.08fr 1fr", gap: 12, alignItems: "start" }}>

          {/* ── Observer ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0, duration: 0.6 }}
            style={{ borderRadius: 20, padding: "26px 22px", border: BORDER, background: "rgba(255,255,255,0.015)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM }}>Observer</div>
              <div style={{
                borderRadius: 6, border: BORDER, background: "rgba(255,255,255,0.04)",
                padding: "3px 9px", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: T_DIM,
              }}>Free forever</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.60)", marginBottom: 14 }}>
              Best for first visibility
            </div>
            <div style={{ fontSize: 40, fontWeight: 200, letterSpacing: "-0.06em", color: "rgba(255,255,255,0.72)", lineHeight: 1 }}>€0</div>
            <div style={{ fontSize: 11, color: T_DIM, marginTop: 4, marginBottom: 18 }}>No credit card required</div>
            <CtxBox title="What you unlock">
              Understand spend, campaign health and baseline profitability before turning decisions into actions.
            </CtxBox>
            <FEAT><B>Profit visibility</B> across your live campaigns</FEAT>
            <FEAT><B>Budget leak detection</B> and core monitoring</FEAT>
            <FEAT>Up to <B>2 connected networks</B></FEAT>
            <FEAT><B>Live dashboard</B> and campaign detail</FEAT>
            <a href="/register?plan=observer" style={{ textDecoration: "none", display: "block", marginTop: 20 }}>
              <button style={{
                width: "100%", height: 42, borderRadius: 10,
                border: BORDER, background: "transparent",
                fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.42)", cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s",
              }}>Start free</button>
            </a>
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: T_DIM, fontStyle: "italic" }}>
              For solo operators validating the setup
            </div>
            <p style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.16)", textAlign: "center", lineHeight: "16px" }}>
              By creating an account, you agree to our{" "}
              <a href="/terms" style={{ color: "rgba(255,255,255,0.26)", textDecoration: "underline" }}>Terms</a>
              {" "}&amp;{" "}
              <a href="/privacy" style={{ color: "rgba(255,255,255,0.26)", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>
          </motion.div>

          {/* ── Operator — dominant, violet ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.08, duration: 0.6 }}
            style={{
              borderRadius: 20, padding: "40px 26px 32px",
              border: `1px solid ${VI_BORDER}`,
              background: VI_BG,
              boxShadow: "0 0 0 1px rgba(124,58,237,0.06), 0 28px 64px rgba(0,0,0,0.36)",
              marginTop: -20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_PRIMARY }}>Operator</div>
              <div style={{
                borderRadius: 6, border: `1px solid ${VI_BORDER}`,
                background: "rgba(124,58,237,0.16)", padding: "3px 10px",
                fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: VI_LIGHT,
              }}>Most popular</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.70)", marginBottom: 14 }}>
              Best for daily campaign decision-making
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 60, fontWeight: 200, letterSpacing: "-0.06em", color: T_PRIMARY, lineHeight: 1 }}>€{p("operator")}</span>
              <span style={{ fontSize: 14, color: T_MUTED }}>/month</span>
            </div>
            <div style={{ fontSize: 11, color: T_DIM, marginTop: 4, marginBottom: 18 }}>
              {annual ? "Billed annually" : "Billed monthly"}
            </div>
            <CtxBox title="Why most operators start here">
              You already run live campaigns. You need faster decisions, cleaner alerts and a system that works with your real revenue signal.
            </CtxBox>
            <FEAT>Everything in <B>Observer</B></FEAT>
            <FEAT><B>Revenue signal tracking</B> across networks</FEAT>
            <FEAT><B>Kill / scale signal alerts</B> and recommendation flows</FEAT>
            <FEAT><B>Auto-kill rules</B> by ROI threshold</FEAT>
            <FEAT><B>Full campaign detail view</B> for faster review</FEAT>
            <a href="/register?plan=operator" style={{ textDecoration: "none", display: "block", marginTop: 22 }}>
              <button style={{
                width: "100%", height: 48, borderRadius: 12,
                border: "none", background: VI,
                fontSize: 14, fontWeight: 600, color: "#ffffff", cursor: "pointer",
                transition: "opacity 0.15s",
              }}>Start with Operator →</button>
            </a>
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "rgba(196,181,253,0.50)", fontStyle: "italic" }}>
              The clearest choice once campaigns are live
            </div>
            <p style={{ marginTop: 12, fontSize: 10, color: "rgba(196,181,253,0.22)", textAlign: "center", lineHeight: "16px" }}>
              By creating an account, you agree to our{" "}
              <a href="/terms" style={{ color: "rgba(196,181,253,0.38)", textDecoration: "underline" }}>Terms</a>
              {" "}&amp;{" "}
              <a href="/privacy" style={{ color: "rgba(196,181,253,0.38)", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>
          </motion.div>

          {/* ── Dominion ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.16, duration: 0.6 }}
            style={{
              borderRadius: 20, padding: "34px 24px",
              background: "rgba(100,116,139,0.12)",
              border: "1px solid rgba(148,163,184,0.36)",
              boxShadow: "0 0 0 1px rgba(148,163,184,0.05), 0 20px 52px rgba(0,0,0,0.32)",
              marginTop: -10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: "#94a3b8" }}>Dominion</div>
              <div style={{
                borderRadius: 6, border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(148,163,184,0.08)", padding: "3px 9px",
                fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em", color: "#cbd5e1",
              }}>Most automated</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.58)", marginBottom: 14 }}>
              Best for full automation at scale
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 52, fontWeight: 200, letterSpacing: "-0.06em", color: T_PRIMARY, lineHeight: 1 }}>€{p("dominion")}</span>
              <span style={{ fontSize: 13, color: T_DIM }}>/month</span>
            </div>
            <div style={{ fontSize: 11, color: T_DIM, marginTop: 4, marginBottom: 18 }}>
              {annual ? "Billed annually" : "Billed monthly"}
            </div>
            <CtxBox title="When to upgrade">
              You trust the engine, you want faster execution, and you do not want to babysit every recommendation manually.
            </CtxBox>
            <FEAT>Everything in <B>Operator</B></FEAT>
            <FEAT><B>Fully automated kill &amp; scale</B> decisions</FEAT>
            <FEAT><B>Priority signal refresh</B> and execution</FEAT>
            <FEAT><B>Multi-network automation</B></FEAT>
            <FEAT><B>Unlimited rules</B> &amp; thresholds</FEAT>
            <a href="/register?plan=dominion" style={{ textDecoration: "none", display: "block", marginTop: 20 }}>
              <button style={{
                width: "100%", height: 44, borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(148,163,184,0.10)",
                fontSize: 13, fontWeight: 600, color: "#e2e8f0", cursor: "pointer",
                transition: "background 0.15s",
              }}>Get Dominion →</button>
            </a>
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
              For operators ready to let the engine run
            </div>
            <p style={{ marginTop: 12, fontSize: 10, color: "rgba(100,116,139,0.50)", textAlign: "center", lineHeight: "16px" }}>
              By creating an account, you agree to our{" "}
              <a href="/terms" style={{ color: "rgba(148,163,184,0.55)", textDecoration: "underline" }}>Terms</a>
              {" "}&amp;{" "}
              <a href="/privacy" style={{ color: "rgba(148,163,184,0.55)", textDecoration: "underline" }}>Privacy Policy</a>.
            </p>
          </motion.div>

        </div>

        {/* ── Command — 2 col layout ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.6 }}
          style={{ marginTop: 16, borderRadius: 20, border: BORDER, background: "rgba(255,255,255,0.02)", padding: "48px 48px" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>

            {/* Left — features */}
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                borderRadius: 8, border: `1px solid ${VI_BORDER}`,
                background: "rgba(124,58,237,0.10)", padding: "4px 12px",
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.20em", color: VI_LIGHT,
                marginBottom: 20,
              }}>Command — Team Plan</div>
              <h3 style={{
                fontSize: 32, fontWeight: 600, letterSpacing: "-0.045em",
                color: T_PRIMARY, lineHeight: 1.1, marginBottom: 14,
              }}>
                Built for teams, agencies,<br />and trading desks.
              </h3>
              <p style={{ fontSize: 15, lineHeight: "26px", color: T_MUTED, marginBottom: 28, maxWidth: "42ch" }}>
                Shared rules, one workspace, role-based oversight, and a cleaner way to operate together without losing control of execution.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[
                  { name: "Shared rules across seats",  desc: "One decision layer for the whole workspace",          badge: "Shared"     },
                  { name: "Role-based oversight",        desc: "Admins, operators, and reviewers in the same stack", badge: "Controlled" },
                  { name: "One unified dashboard",       desc: "See spend, revenue and actions across the team",     badge: "Unified"    },
                ].map(({ name, desc, badge }) => (
                  <div key={name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 0", borderBottom: `1px solid ${BORDER_FAINT}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: T_PRIMARY, marginBottom: 3 }}>{name}</div>
                      <div style={{ fontSize: 13, color: T_MUTED }}>{desc}</div>
                    </div>
                    <div style={{
                      marginLeft: 16, flexShrink: 0,
                      borderRadius: 6, border: BORDER,
                      background: "rgba(255,255,255,0.04)", padding: "3px 10px",
                      fontSize: 10, letterSpacing: "0.08em", color: "rgba(255,255,255,0.40)",
                    }}>{badge}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — quote card */}
            <div style={{
              borderRadius: 16, border: BORDER,
              background: "rgba(255,255,255,0.03)",
              padding: "32px 28px",
              display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 320,
            }}>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM, marginBottom: 20 }}>Command</div>
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.04em", color: T_PRIMARY, lineHeight: 1.2, marginBottom: 16 }}>
                  For agencies that need shared execution, not just more seats.
                </div>
                <div style={{ fontSize: 14, lineHeight: "24px", color: T_MUTED }}>
                  Bring multiple operators into one workspace, centralize the rules, and keep campaign control aligned across the whole team.
                </div>
              </div>
              <a href="mailto:hello@profitdash.io" style={{ textDecoration: "none", marginTop: 28 }}>
                <button style={{
                  width: "100%", height: 46, borderRadius: 11,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  fontSize: 14, fontWeight: 600, color: T_PRIMARY, cursor: "pointer",
                  transition: "background 0.15s",
                }}>Talk to us →</button>
              </a>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — FAQ
// ─────────────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Does ProfitDash make decisions automatically, or do I decide?",
    a: "Both — and you choose per campaign. In automatic mode, the engine acts directly: it pauses or scales campaigns without waiting for your input. In recommendation mode, it logs exactly what it would have done and flags it for your review. You can mix modes freely across campaigns.",
  },
  {
    q: "Which ad networks are supported?",
    a: "ExoClick, TrafficStars, TrafficJunky, PropellerAds, and Adsterra are all fully connected. You can link as many as your plan allows, and more networks are being added.",
  },
  {
    q: "What happens if I close the dashboard?",
    a: "Nothing changes. The engine runs entirely server-side — it doesn't need your browser open to operate. Every morning you'll receive a daily briefing email with everything it did while you were away, plus any campaigns that need your attention.",
  },
  {
    q: "How does revenue tracking work?",
    a: "ProfitDash generates a unique postback URL for your workspace. You paste it into your affiliate network or tracker, and revenue signals start flowing automatically — no manual imports, no spreadsheets, no guesswork.",
  },
  {
    q: "Can I exclude a campaign from automation?",
    a: "Yes. Each campaign has a 'Manual only' toggle. The engine will still monitor it and surface recommendations, but it will never take action without your explicit approval.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The Observer plan is free forever. It gives you real profit visibility, budget leak detection, and up to 2 connected networks — with no credit card required. You only upgrade when your campaigns demand it.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{
      ...SEC,
      background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.05), transparent 24%)",
    }}>
      <div style={{ margin: "0 auto", maxWidth: 860 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Pill color={VIOLET}>FAQ</Pill>
          <h2 style={{
            marginTop: 24, fontSize: 52, fontWeight: 600, lineHeight: 1.0,
            letterSpacing: "-0.055em", color: T_PRIMARY,
          }}>
            Common questions.
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              style={{
                borderRadius: 16,
                border: `1px solid ${open === i ? "rgba(255,255,255,0.10)" : BORDER_FAINT}`,
                background: open === i ? "rgba(255,255,255,0.025)" : "transparent",
                overflow: "hidden",
                transition: "border-color 0.2s ease, background 0.2s ease",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "22px 24px", background: "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 500, color: T_PRIMARY, letterSpacing: "-0.02em", lineHeight: 1.4 }}>{q}</span>
                <span style={{
                  flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                  border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: T_MUTED, fontWeight: 300,
                  transition: "transform 0.22s ease",
                  transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                }}>+</span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ padding: "0 24px 24px", fontSize: 15, lineHeight: "27px", color: T_MUTED }}>
                      {a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — RECOMMEND VS AUTOMATIC
// ─────────────────────────────────────────────────────────────────────────────

function RecommendVsAutoSection() {
  const CARD: React.CSSProperties = {
    flex: 1,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg,rgba(14,15,22,0.95),rgba(9,10,16,0.98))",
    padding: "36px 32px",
    boxShadow: "0 16px 52px rgba(0,0,0,0.30)",
  };

  const ROW = ({
    label, value, color = T_PRIMARY,
  }: { label: string; value: string; color?: string }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: `1px solid ${BORDER_FAINT}`,
    }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color }}>{value}</span>
    </div>
  );

  return (
    <section style={{
      ...SEC,
      background: [
        "radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.05), transparent 30%)",
        "radial-gradient(ellipse at 80% 50%, rgba(74,222,128,0.04), transparent 30%)",
      ].join(","),
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1100 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Pill color={VIOLET}>Two modes</Pill>
          <h2 style={{
            marginTop: 24, fontSize: 56, fontWeight: 600, lineHeight: 0.95,
            letterSpacing: "-0.06em", color: T_PRIMARY,
          }}>
            Your engine, your rules.
          </h2>
          <p style={{ marginTop: 18, maxWidth: "38ch", margin: "18px auto 0", fontSize: 17, lineHeight: "30px", color: T_MUTED }}>
            Choose how much you trust the engine — per campaign, not globally.
          </p>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "stretch" }}>

          {/* Recommendation mode */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={CARD}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                borderRadius: 8, border: "1px solid rgba(251,191,36,0.24)",
                background: "rgba(251,191,36,0.07)", padding: "4px 12px",
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.20em", color: "#fde68a",
                marginBottom: 20,
              }}>⬡ Recommendation mode</div>
            </div>
            <h3 style={{
              fontSize: 28, fontWeight: 500, letterSpacing: "-0.04em",
              color: T_PRIMARY, lineHeight: 1.1, marginBottom: 14,
            }}>The engine advises.<br />You decide.</h3>
            <p style={{ fontSize: 14, lineHeight: "26px", color: "rgba(255,255,255,0.40)", marginBottom: 28, maxWidth: "32ch" }}>
              ProfitDash logs every action it would have taken. You review, approve, or dismiss — at your own pace.
            </p>

            {/* Mock recommendation card — rows stagger in */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-5%" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.10, delayChildren: 0.15 } } }}
              style={{
                borderRadius: 16, border: "1px solid rgba(251,191,36,0.16)",
                background: "rgba(251,191,36,0.05)", padding: "20px 20px",
              }}
            >
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(251,191,36,0.70)", marginBottom: 14 }}>Engine recommendation</div>
              {([
                { label: "Campaign",        value: "VPN_FR_02",      color: T_PRIMARY  },
                { label: "Current ROI",     value: "−31%",           color: KILL_COL   },
                { label: "Suggested action",value: "Kill",           color: "#fde68a"  },
                { label: "Reason",          value: "Below −25% for 3h", color: T_PRIMARY },
              ] as const).map(({ label, value, color }) => (
                <motion.div
                  key={label}
                  variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16,1,0.3,1] } } }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${BORDER_FAINT}` }}
                >
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color }}>{value}</span>
                </motion.div>
              ))}
              <motion.div
                variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16,1,0.3,1] } } }}
                style={{ marginTop: 16, display: "flex", gap: 8 }}
              >
                <button style={{
                  flex: 1, height: 36, borderRadius: 8,
                  background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.22)",
                  fontSize: 12, fontWeight: 600, color: "#fca5a5", cursor: "pointer",
                }}>Approve kill</button>
                <button style={{
                  flex: 1, height: 36, borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                  fontSize: 12, color: "rgba(255,255,255,0.30)", cursor: "pointer",
                }}>Dismiss</button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Divider */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 12, flexShrink: 0, padding: "0 8px",
          }}>
            <div style={{ width: 1, flex: 1, background: BORDER_FAINT }} />
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.03)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: T_DIM,
            }}>or</div>
            <div style={{ width: 1, flex: 1, background: BORDER_FAINT }} />
          </div>

          {/* Automatic mode */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ ...CARD, borderColor: "rgba(139,92,246,0.20)", background: "linear-gradient(180deg,rgba(18,12,30,0.96),rgba(10,8,18,0.98))" }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                borderRadius: 8, border: "1px solid rgba(139,92,246,0.28)",
                background: "rgba(139,92,246,0.09)", padding: "4px 12px",
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.20em", color: "#c4b5fd",
                marginBottom: 20,
              }}>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa" }}
                />
                Automatic mode
              </div>
            </div>
            <h3 style={{
              fontSize: 28, fontWeight: 500, letterSpacing: "-0.04em",
              color: T_PRIMARY, lineHeight: 1.1, marginBottom: 14,
            }}>The engine acts.<br />While you sleep.</h3>
            <p style={{ fontSize: 14, lineHeight: "26px", color: "rgba(255,255,255,0.40)", marginBottom: 28, maxWidth: "32ch" }}>
              ProfitDash calls the ad network API directly. Campaigns get killed, scaled, or held — with no action required from you.
            </p>

            {/* Mock automatic execution log — entries type in one by one */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-5%" }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.16, delayChildren: 0.20 } } }}
              style={{
                borderRadius: 16, border: "1px solid rgba(139,92,246,0.18)",
                background: "rgba(139,92,246,0.05)", padding: "20px 20px",
              }}
            >
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(167,139,250,0.70)", marginBottom: 14 }}>Engine log</div>
              {[
                { time: "03:14", msg: "Killed VPN_FR_02 · ROI −31%",      col: KILL_COL                     },
                { time: "03:14", msg: "Paused ExoClick API · confirmed",   col: "rgba(255,255,255,0.30)"     },
                { time: "06:22", msg: "Scaled Nutra_US_01 · ROI +41%",    col: SCALE_COL                    },
                { time: "06:23", msg: "Budget increased +20% via API",     col: "rgba(255,255,255,0.30)"     },
              ].map(({ time, msg, col }, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.16,1,0.3,1] } } }}
                  style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "7px 0", borderBottom: i < 3 ? `1px solid ${BORDER_FAINT}` : undefined,
                  }}
                >
                  <span style={{ fontSize: 9, color: T_DIM, fontVariantNumeric: "tabular-nums", flexShrink: 0, marginTop: 1, fontFamily: "ui-monospace,monospace" }}>{time}</span>
                  <span style={{ fontSize: 12, color: col, lineHeight: "18px" }}>{msg}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

        </div>

        <div style={{
          marginTop: 28, textAlign: "center",
          fontSize: 13, color: "rgba(255,255,255,0.26)",
        }}>
          Switch modes per campaign at any time · No code required
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — TRUST / CREDIBILITY
// ─────────────────────────────────────────────────────────────────────────────

function TrustSection() {
  const TRUST_POINTS = [
    {
      icon: "🔒",
      title: "API credentials are encrypted",
      body: "Your ad network keys are stored with AES-256 encryption at rest. They are never logged, never shared, and only used to operate your campaigns.",
      col: SKY,
    },
    {
      icon: "🏗️",
      title: "Automation is fully server-side",
      body: "The engine runs on Vercel cron jobs — not in your browser. Close the dashboard, turn off your computer. The robot keeps working.",
      col: VIOLET,
    },
    {
      icon: "👁️",
      title: "Every action is logged",
      body: "Every kill, scale, or hold the engine takes is stored in your action log with a timestamp and a reason. You always know exactly what happened and why.",
      col: TRACK_COL,
    },
    {
      icon: "📬",
      title: "Daily briefing in your inbox",
      body: "Every morning at 9am, you receive a summary of what the engine did overnight — what it killed, what it scaled, what needs your attention today.",
      col: SCALE_COL,
    },
  ];

  return (
    <section style={{
      ...SEC,
      background: [
        "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.04), transparent 22%)",
        "radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.04), transparent 22%)",
      ].join(","),
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1100 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Pill color={SKY}>Built for trust</Pill>
          <h2 style={{
            marginTop: 24, fontSize: 52, fontWeight: 600, lineHeight: 0.96,
            letterSpacing: "-0.06em", color: T_PRIMARY,
          }}>
            Credibility is a feature.
          </h2>
          <p style={{ marginTop: 18, maxWidth: "36ch", margin: "18px auto 0", fontSize: 17, lineHeight: "30px", color: T_MUTED }}>
            An engine that touches live campaigns has to earn trust. Here is how ProfitDash does it.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {TRUST_POINTS.map(({ icon, title, body, col }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                borderRadius: 20, border: `1px solid ${BORDER_FAINT}`,
                background: "rgba(255,255,255,0.015)",
                padding: "32px 28px",
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Subtle color wash */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                background: `radial-gradient(circle at 10% 20%, ${col}07, transparent 50%)`,
                pointerEvents: "none",
              }} />
              <div style={{ fontSize: 28, marginBottom: 18 }}>{icon}</div>
              <div style={{
                fontSize: 16, fontWeight: 600, letterSpacing: "-0.03em",
                color: T_PRIMARY, marginBottom: 10, position: "relative",
              }}>{title}</div>
              <div style={{
                fontSize: 14, lineHeight: "26px", color: "rgba(255,255,255,0.40)",
                position: "relative",
              }}>{body}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12 — FINAL CTA / BRAND CLOSURE
// ─────────────────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section style={{
      position: "relative", overflow: "hidden", padding: "120px 48px 110px",
      background: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.025), transparent 28%)",
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1000, textAlign: "center" }}>
        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{
            margin: "44px auto 0", maxWidth: "13ch",
            fontSize: 72, fontWeight: 600, lineHeight: 0.92,
            letterSpacing: "-0.065em", color: T_PRIMARY,
          }}
        >
          Stop watching campaigns.<br />
          <span style={{ color: "rgba(167,139,250,0.90)" }}>Start commanding them.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.1 }}
          style={{ margin: "22px auto 0", maxWidth: "34ch", fontSize: 19, lineHeight: "32px", color: T_MUTED }}
        >
          The engine runs 24/7. Kill leaks before they compound. Scale winners before the window closes.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.18 }}
          style={{ marginTop: 46, display: "flex", justifyContent: "center", gap: 14 }}
        >
          <a href="/register" style={{ textDecoration: "none" }}>
            <button style={{
              height: 56, borderRadius: 16,
              background: "#ffffff",
              padding: "0 36px", fontSize: 15, fontWeight: 600,
              color: "#000000", border: "none", cursor: "pointer",
            }}>Get early access →</button>
          </a>
          <a href="#the-system" style={{ textDecoration: "none" }}>
            <button style={{
              height: 56, borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)", padding: "0 36px",
              fontSize: 15, fontWeight: 600,
              color: "rgba(255,255,255,0.70)", cursor: "pointer",
            }}>View the system</button>
          </a>
        </motion.div>
      </div>

    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: `1px solid ${BORDER_FAINT}`,
      background: "rgba(255,255,255,0.006)",
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1640, padding: "52px 48px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 48, marginBottom: 48 }}>

          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <LogoIcon size={26} />
              <span style={{ fontSize: 18, letterSpacing: "-0.04em", fontWeight: 400 }}>
                <span style={{ color: T_PRIMARY }}>Profit</span><span style={{ color: "rgba(167,139,250,0.82)" }}>Dash</span>
              </span>
            </div>
            <p style={{ fontSize: 14, lineHeight: "23px", color: T_DIM, maxWidth: "30ch", marginBottom: 22 }}>
              Autonomous campaign operator for media buyers. Kill leaks. Scale winners. Sleep better.
            </p>
            <a href="mailto:hello@profitdash.io" style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", textDecoration: "none" }}>
              hello@profitdash.io
            </a>
          </div>

          {/* Product */}
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM, marginBottom: 18 }}>Product</div>
            {([
              ["How it works", "#how-it-works"],
              ["The system",   "#the-system"  ],
              ["Results",      "#results"     ],
              ["Pricing",      "#pricing"     ],
              ["Sign in",      "/login"       ],
            ] as const).map(([label, href]) => (
              <a key={label} href={href} style={{
                display: "block", fontSize: 14, color: "rgba(255,255,255,0.36)",
                textDecoration: "none", marginBottom: 11,
                transition: "color 0.15s",
              }}>{label}</a>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: T_DIM, marginBottom: 18 }}>Legal</div>
            {([
              ["Privacy Policy", "/privacy"],
              ["Terms of Service", "/terms"],
            ] as const).map(([label, href]) => (
              <a key={label} href={href} style={{
                display: "block", fontSize: 14, color: "rgba(255,255,255,0.36)",
                textDecoration: "none", marginBottom: 11,
              }}>{label}</a>
            ))}
          </div>
        </div>

        <div style={{
          paddingTop: 24, borderTop: `1px solid ${BORDER_FAINT}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, color: T_DIM,
        }}>
          <span>© {new Date().getFullYear()} ProfitDash. All rights reserved.</span>
          <span style={{ color: "rgba(255,255,255,0.18)" }}>Built for media buyers who move fast.</span>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Grain SVG data URI (fixed, overlaid on everything for texture)
  const grainUrl = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  return (
    <div style={{
      minHeight: "100vh", background: BG, color: T_PRIMARY,
      fontFamily: "var(--font-geist, system-ui, sans-serif)",
      position: "relative",
    }}>

      {/* Grain texture overlay — subtle noise on the whole page */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 200,
        backgroundImage: grainUrl,
        opacity: 0.028,
        mixBlendMode: "overlay",
      }} />

      {/* Sticky header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: scrolled ? `1px solid ${BORDER_FAINT}` : "1px solid transparent",
        background: scrolled ? `rgba(5,6,10,0.92)` : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        transition: "background 0.35s ease, border-color 0.35s ease, backdrop-filter 0.35s ease",
      }}>
        <div style={{
          margin: "0 auto", maxWidth: 1640, padding: "18px 48px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoIcon size={30} />
            <div style={{ fontSize: 22, letterSpacing: "-0.05em", fontWeight: 400 }}>
              <span style={{ color: T_PRIMARY }}>Profit</span><span style={{ color: "rgba(167,139,250,0.82)" }}>Dash</span>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 36, fontSize: 13 }}>
            {([
              ["How it works","#how-it-works"],
              ["The system",  "#the-system" ],
              ["Results",     "#results"    ],
              ["Pricing",     "#pricing"    ],
            ] as const).map(([label, href]) => (
              <a key={label} href={href} style={{
                color: "rgba(255,255,255,0.40)", textDecoration: "none", cursor: "pointer",
              }}>{label}</a>
            ))}
            <a href="/login" style={{ color: "rgba(255,255,255,0.40)", textDecoration: "none", cursor: "pointer" }}>Sign in</a>
          </nav>

          <a href="/register" style={{ textDecoration: "none" }}>
            <button style={{
              height: 44, borderRadius: 12,
              background: "#ffffff",
              padding: "0 22px", fontSize: 13, fontWeight: 600,
              color: "#000000", border: "none", cursor: "pointer",
            }}>Get early access</button>
          </a>
        </div>
      </header>

      <HeroSection />
      <SyncStrip />
      <LosingCampaignSection />
      <EngineRevealSection />
      <RecommendVsAutoSection />
      <SetupSection />
      <ProductPeekSection />
      <StatsSection />
      <TrustSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
