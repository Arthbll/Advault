"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Zap, Loader2, ArrowRight, Lock } from "lucide-react";
import { saveAccount } from "@/app/actions/accounts";

// ─── Types ────────────────────────────────────────────────────────────────────

type NetworkId =
  | "EXOCLICK" | "TRAFFICSTARS" | "TRAFFICJUNKY"
  | "PROPELLERADS" | "ADSTERRA" | "VOLUUM" | "BEMOB";

type NetState = "idle" | "saving" | "connected" | "error";

interface NetworkCfg {
  id: NetworkId;
  label: string;
  color: string;
  rgb: string;
  keyLabel: string;
  category: "network" | "tracker";
}

interface SyncResult {
  synced: number;
  days: number;
  errors?: string[];
}

interface RevenueSignal {
  hasRevenue: boolean;
  postbackCount: number;
  postbackRevenue: number;
  campaignRevenue: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORKS: NetworkCfg[] = [
  { id: "EXOCLICK",     label: "ExoClick",     color: "#f59e0b", rgb: "245,158,11",  keyLabel: "API Key",              category: "network"  },
  { id: "TRAFFICSTARS", label: "TrafficStars", color: "#8b5cf6", rgb: "139,92,246",  keyLabel: "Refresh Token",        category: "network"  },
  { id: "TRAFFICJUNKY", label: "TrafficJunky", color: "#0ea5e9", rgb: "14,165,233",  keyLabel: "API Key",              category: "network"  },
  { id: "PROPELLERADS", label: "PropellerAds", color: "#f97316", rgb: "249,115,22",  keyLabel: "API Token",            category: "network"  },
  { id: "ADSTERRA",     label: "Adsterra",     color: "#06b6d4", rgb: "6,182,212",   keyLabel: "API Key",              category: "network"  },
  { id: "VOLUUM",       label: "Voluum",        color: "#a78bfa", rgb: "167,139,250", keyLabel: "Access Key ID",        category: "tracker"  },
  { id: "BEMOB",        label: "Bemob",         color: "#34d399", rgb: "52,211,153",  keyLabel: "API Key",              category: "tracker"  },
];

const TOTAL_STEPS = 6;
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

// ─── Shared styles ────────────────────────────────────────────────────────────

const BG      = "#07080d";
const LINE    = "rgba(255,255,255,0.08)";
const MUTED   = "rgba(255,255,255,0.45)";
const TEXT    = "rgba(255,255,255,0.90)";
const ACCENT  = "#7c6cff";
const ACCENT2 = "#5f8cff";

// ─── Tag component ────────────────────────────────────────────────────────────

type TagVariant = "ok" | "warn" | "bad" | "neutral" | "blue";

const TAG_STYLES: Record<TagVariant, { bg: string; color: string }> = {
  ok:      { bg: "rgba(117,227,159,0.12)", color: "#75e39f" },
  warn:    { bg: "rgba(241,195,95,0.12)",  color: "#f1c35f" },
  bad:     { bg: "rgba(255,139,139,0.12)", color: "#ff8b8b" },
  neutral: { bg: "rgba(255,255,255,0.06)", color: MUTED     },
  blue:    { bg: "rgba(95,140,255,0.12)",  color: "#5f8cff" },
};

function Tag({ v, children }: { v: TagVariant; children: React.ReactNode }) {
  const s = TAG_STYLES[v];
  return (
    <span style={{
      padding: "5px 11px", borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
      whiteSpace: "nowrap" as const,
    }}>
      {children}
    </span>
  );
}

// ─── Row (status line) ────────────────────────────────────────────────────────

function Row({ label, tag, v }: { label: string; tag: string; v: TagVariant }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 12, border: `1px solid ${LINE}`, borderRadius: 14,
      padding: "11px 14px", background: "rgba(255,255,255,0.02)",
    }}>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{label}</span>
      <Tag v={v}>{tag}</Tag>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: 22,
      padding: 22, background: "rgba(255,255,255,0.02)",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function Cta({
  children, onClick, disabled, loading, variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "rec" | "auto";
}) {
  const bgMap = {
    primary: `linear-gradient(90deg,${ACCENT},${ACCENT2})`,
    ghost:   "rgba(255,255,255,0.05)",
    rec:     `linear-gradient(90deg,${ACCENT},${ACCENT2})`,
    auto:    "linear-gradient(90deg,#34d399,#059669)",
  };
  const colorMap = {
    primary: "#fff", ghost: MUTED, rec: "#fff", auto: "#fff",
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        marginTop: 18, padding: "13px 20px",
        borderRadius: 16, border: "none",
        background: disabled ? "rgba(255,255,255,0.06)" : bgMap[variant],
        color: disabled ? "rgba(255,255,255,0.25)" : colorMap[variant],
        fontSize: 14, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : variant === "primary" || variant === "rec" ? "0 8px 28px rgba(124,108,255,0.22)" : "none",
        transition: "all 0.2s",
      }}
    >
      {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : children}
    </motion.button>
  );
}

// ─── Shell + Nav ──────────────────────────────────────────────────────────────

function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100dvh", background: BG,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Nav bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 28px", borderBottom: `1px solid ${LINE}`,
        background: "rgba(7,8,13,0.90)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>ProfitDash</span>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width:      i + 1 === step ? 22 : 8,
                background: i + 1 < step
                  ? "rgba(124,108,255,0.65)"
                  : i + 1 === step
                  ? ACCENT
                  : "rgba(255,255,255,0.14)",
              }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ height: 8, borderRadius: 4 }}
            />
          ))}
        </div>

        <span style={{ fontSize: 12, color: MUTED, letterSpacing: "0.06em" }}>
          {step} / {TOTAL_STEPS}
        </span>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 24px 60px",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Two-column container ─────────────────────────────────────────────────────

function Split({ left, right, ratio = "1fr 1fr" }: {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio?: string;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: ratio,
      gap: 18, width: "100%", maxWidth: 900,
      alignItems: "start",
    }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const PREVIEW = [
    { n: "1", label: "Connect a network",   sub: "ExoClick, TrafficStars, Voluum…" },
    { n: "2", label: "Set up postback",      sub: "Plug revenue into every campaign"  },
    { n: "3", label: "Run first sync",       sub: "Import live spend data"            },
    { n: "4", label: "Activate the engine",  sub: "Budget protection + profit rules"  },
  ];

  return (
    <Split
      ratio="1.15fr 0.85fr"
      left={
        <Card>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 14 }}>
            Welcome
          </div>
          <h2 style={{ margin: "0 0 12px", fontSize: "clamp(28px,4vw,42px)", fontWeight: 700, lineHeight: 1.05, color: TEXT, letterSpacing: "-0.04em" }}>
            Connect your data.<br />Protect your budget.
          </h2>
          <p style={{ margin: 0, color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: "34ch" }}>
            4 steps · takes about 3 minutes. ProfitDash needs your ad data to make smart decisions.
          </p>
          <Cta onClick={onNext}>
            Start setup <ArrowRight size={14} />
          </Cta>
        </Card>
      }
      right={
        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            What we'll set up
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {PREVIEW.map(p => (
              <div key={p.n} style={{
                display: "flex", alignItems: "center", gap: 12,
                border: `1px solid ${LINE}`, borderRadius: 14,
                padding: "12px 14px", background: "rgba(255,255,255,0.02)",
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(124,108,255,0.15)",
                  border: `1px solid rgba(124,108,255,0.25)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: ACCENT,
                }}>
                  {p.n}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      }
    />
  );
}

// ─── Step 2: Connect network ──────────────────────────────────────────────────

function Step2({
  onNext,
  connectedNetworks,
  setConnectedNetworks,
}: {
  onNext: () => void;
  connectedNetworks: Set<NetworkId>;
  setConnectedNetworks: (s: Set<NetworkId>) => void;
}) {
  const [selected, setSelected]   = useState<NetworkId | null>(null);
  const [apiKey, setApiKey]       = useState("");
  const [states, setStates]       = useState<Partial<Record<NetworkId, NetState>>>({});
  const [errMsg, setErrMsg]       = useState<string | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const hasAny                    = connectedNetworks.size > 0;

  const adNetworks = NETWORKS.filter(n => n.category === "network");
  const trackers   = NETWORKS.filter(n => n.category === "tracker");

  function selectNet(id: NetworkId) {
    if (connectedNetworks.has(id)) return;
    setSelected(id);
    setApiKey("");
    setErrMsg(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  async function handleConnect() {
    if (!selected) return;
    const key = apiKey.trim();
    if (!key) { setErrMsg("API key is required."); return; }

    setStates(s => ({ ...s, [selected]: "saving" }));
    setErrMsg(null);

    const fd = new FormData();
    fd.set("network", selected);
    fd.set("apiKey", key);

    const result = await saveAccount(fd);

    if (result?.error) {
      setStates(s => ({ ...s, [selected]: "error" }));
      setErrMsg(result.error);
    } else {
      setStates(s => ({ ...s, [selected]: "connected" }));
      const next = new Set(connectedNetworks);
      next.add(selected);
      setConnectedNetworks(next);
      setSelected(null);
      setApiKey("");
    }
  }

  function netState(id: NetworkId): NetState {
    if (connectedNetworks.has(id)) return "connected";
    return states[id] ?? "idle";
  }

  function tagProps(id: NetworkId): { v: TagVariant; label: string } {
    const st = netState(id);
    if (st === "connected") return { v: "ok",      label: "Connected" };
    if (st === "saving")    return { v: "blue",    label: "Connecting…" };
    if (st === "error")     return { v: "bad",     label: "Error"      };
    if (id === selected)    return { v: "neutral", label: "Selected"   };
    return                         { v: "neutral", label: "Available"  };
  }

  const selectedCfg = selected ? NETWORKS.find(n => n.id === selected) : null;
  const isSaving    = selected ? states[selected] === "saving" : false;

  function renderNetGrid(list: NetworkCfg[], title: string) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: MUTED, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {list.map(net => {
            const { v, label } = tagProps(net.id);
            const isConn = connectedNetworks.has(net.id);
            const isSel  = selected === net.id;
            return (
              <div
                key={net.id}
                onClick={() => !isConn && selectNet(net.id)}
                style={{
                  border: `1px solid ${isSel ? `rgba(124,108,255,0.35)` : isConn ? "rgba(117,227,159,0.22)" : LINE}`,
                  borderRadius: 18, padding: "16px 14px",
                  background: isSel ? "rgba(124,108,255,0.07)" : isConn ? "rgba(117,227,159,0.04)" : "rgba(255,255,255,0.02)",
                  cursor: isConn ? "default" : "pointer",
                  transition: "all 0.18s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: isConn ? "#75e39f" : net.color, flexShrink: 0 }} />
                  <strong style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{net.label}</strong>
                </div>
                <Tag v={v}>{label}</Tag>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: MUTED }}>Step 1 of 4</span>
      </div>
      <h2 style={{ margin: "0 0 24px", fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 700, letterSpacing: "-0.04em", color: TEXT }}>
        Connect a network.
      </h2>

      {/* Network grid */}
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 22, padding: 20, background: "rgba(255,255,255,0.015)", marginBottom: 18 }}>
        {renderNetGrid(adNetworks, "Ad networks")}
        {renderNetGrid(trackers, "Trackers & attribution")}
      </div>

      {/* Form + status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* API key form */}
        <Card>
          {selectedCfg ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 12, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                {selectedCfg.label} — {selectedCfg.keyLabel}
              </div>
              <input
                ref={inputRef}
                type="password"
                placeholder={`Paste your ${selectedCfg.keyLabel.toLowerCase()} here`}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setErrMsg(null); }}
                onKeyDown={e => e.key === "Enter" && handleConnect()}
                style={{
                  width: "100%", padding: "10px 13px",
                  borderRadius: 12, fontSize: 13,
                  outline: "none", boxSizing: "border-box" as const,
                  background: "rgba(255,255,255,0.04)",
                  border: errMsg ? "1px solid rgba(255,139,139,0.35)" : `1px solid rgba(124,108,255,0.25)`,
                  color: TEXT, fontFamily: "monospace", colorScheme: "dark",
                  marginBottom: errMsg ? 6 : 14,
                }}
              />
              {errMsg && (
                <div style={{ fontSize: 11, color: "#ff8b8b", marginBottom: 10 }}>{errMsg}</div>
              )}
              <Cta onClick={handleConnect} loading={isSaving} disabled={isSaving}>
                {isSaving ? "Connecting…" : `Connect ${selectedCfg.label}`}
              </Cta>
            </>
          ) : (
            <div style={{ color: MUTED, fontSize: 13, paddingTop: 8 }}>
              ← Select a network above to add your credentials.
            </div>
          )}
        </Card>

        {/* Connection status */}
        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 12, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Status
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Row
              label="Connected networks"
              tag={connectedNetworks.size > 0 ? `${connectedNetworks.size} connected` : "None yet"}
              v={connectedNetworks.size > 0 ? "ok" : "neutral"}
            />
            <Row
              label="API credentials"
              tag={selectedCfg ? "Ready to save" : connectedNetworks.size > 0 ? "Saved" : "Waiting"}
              v={selectedCfg ? "blue" : connectedNetworks.size > 0 ? "ok" : "neutral"}
            />
            <Row
              label="Sync"
              tag={connectedNetworks.size > 0 ? "Ready" : "Pending"}
              v={connectedNetworks.size > 0 ? "ok" : "neutral"}
            />
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Cta onClick={onNext} disabled={!hasAny}>
          Continue <ArrowRight size={14} />
        </Cta>
        <Cta onClick={onNext} variant="ghost">
          Skip for now
        </Cta>
      </div>
    </div>
  );
}

// ─── Step 3: Postback ─────────────────────────────────────────────────────────

function Step3({ onNext }: { onNext: () => void }) {
  const [postbackUrl, setPostbackUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/postback-token")
      .then(r => r.json())
      .then((d: { postbackUrl?: string }) => { if (d.postbackUrl) setPostbackUrl(d.postbackUrl); })
      .catch(() => {});
  }, []);

  function handleCopy() {
    if (!postbackUrl) return;
    navigator.clipboard.writeText(postbackUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: MUTED }}>Step 2 of 4</span>
      </div>
      <h2 style={{ margin: "0 0 24px", fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 700, letterSpacing: "-0.04em", color: TEXT }}>
        Set up your postback.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 18, marginBottom: 20 }}>
        {/* URL block */}
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 12, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
            Revenue signal
          </div>
          <p style={{ margin: "0 0 16px", color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
            Paste this URL into your CPA network or tracker. Without it, ProfitDash can&apos;t see revenue — and profit-based decisions stay off.
          </p>

          {/* URL box */}
          <div style={{
            borderRadius: 14, border: `1px solid rgba(95,140,255,0.18)`,
            background: "rgba(95,140,255,0.04)", overflow: "hidden", marginBottom: 0,
          }}>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.50)", lineHeight: 1.7, wordBreak: "break-all" as const, minHeight: 40 }}>
                {postbackUrl ?? <span style={{ color: "rgba(255,255,255,0.20)" }}>Loading…</span>}
              </div>
            </div>
            <button
              onClick={handleCopy}
              disabled={!postbackUrl}
              style={{
                width: "100%", height: 40,
                background: copied ? "rgba(117,227,159,0.09)" : "rgba(95,140,255,0.07)",
                border: "none",
                borderTop: `1px solid rgba(95,140,255,0.14)`,
                color: copied ? "#75e39f" : "#5f8cff",
                fontSize: 12, fontWeight: 700,
                cursor: postbackUrl ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "background 0.2s, color 0.2s",
              }}
            >
              {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy URL</>}
            </button>
          </div>

          <Cta onClick={onNext}>
            Done, continue <ArrowRight size={14} />
          </Cta>
        </Card>

        {/* Parameters */}
        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            URL parameters
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <Row label="clickId"  tag="Best practice" v="ok"      />
            <Row label="payout"   tag="Required"      v="ok"      />
            <Row label="source"   tag="Optional"      v="neutral" />
          </div>
          <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 12, border: `1px solid rgba(241,195,95,0.16)`, background: "rgba(241,195,95,0.04)" }}>
            <div style={{ fontSize: 12, color: "#f1c35f", lineHeight: 1.6 }}>
              Map each parameter to the matching token in your tracker (e.g. <code style={{ fontFamily: "monospace" }}>{"{payout}"}</code> → conversion value).
            </div>
          </div>
          <Cta onClick={onNext} variant="ghost">
            Skip for now
          </Cta>
        </Card>
      </div>
    </div>
  );
}

// ─── Step 4: First sync ───────────────────────────────────────────────────────

function Step4({
  onNext,
  syncResult,
  setSyncResult,
}: {
  onNext: () => void;
  syncResult: SyncResult | null;
  setSyncResult: (r: SyncResult) => void;
}) {
  const [phase, setPhase] = useState<"loading" | "done" | "error">(syncResult ? "done" : "loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [dots, setDots] = useState(".");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || syncResult) return;
    started.current = true;

    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "daily" }),
    })
      .then(r => r.json())
      .then((data: SyncResult & { skipped?: boolean }) => {
        setSyncResult({ synced: data.synced ?? 0, days: data.days ?? 1, errors: data.errors });
        setPhase("done");
      })
      .catch((e: unknown) => {
        setErrMsg(e instanceof Error ? e.message : "Sync failed");
        setPhase("error");
      });
  }, [syncResult, setSyncResult]);

  useEffect(() => {
    if (phase !== "loading") return;
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(iv);
  }, [phase]);

  const sr = syncResult;

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: MUTED }}>Step 3 of 4</span>
      </div>
      <h2 style={{ margin: "0 0 24px", fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 700, letterSpacing: "-0.04em", color: TEXT }}>
        {phase === "loading" ? `Syncing campaigns${dots}` : phase === "done" ? `${sr?.synced ?? 0} campaign records found.` : "Sync unavailable."}
      </h2>

      <AnimatePresence mode="wait">
        {phase === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 24, maxWidth: 900 }}>
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ height: "100%", width: "35%", background: `linear-gradient(90deg,transparent,${ACCENT},transparent)`, borderRadius: 3 }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <Card>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
                  Fetching today&apos;s spend data from your connected networks. This usually takes a few seconds.
                </div>
              </Card>
              <Card>
                <div style={{ display: "grid", gap: 10 }}>
                  <Row label="Campaigns"  tag="Importing…" v="blue"    />
                  <Row label="Spend"      tag="Importing…" v="blue"    />
                  <Row label="Revenue"    tag="Waiting"    v="neutral" />
                  <Row label="Engine"     tag="Next"       v="neutral" />
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {phase === "done" && sr && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <Card>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                  <div style={{ border: `1px solid rgba(124,108,255,0.18)`, borderRadius: 14, padding: "14px 16px", background: "rgba(124,108,255,0.05)" }}>
                    <div style={{ fontSize: 30, fontWeight: 300, color: TEXT, letterSpacing: "-0.03em" }}>{sr.synced}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>campaign records</div>
                  </div>
                  <div style={{ border: `1px solid rgba(95,140,255,0.18)`, borderRadius: 14, padding: "14px 16px", background: "rgba(95,140,255,0.05)" }}>
                    <div style={{ fontSize: 30, fontWeight: 300, color: TEXT, letterSpacing: "-0.03em" }}>{sr.days}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>day(s) fetched</div>
                  </div>
                </div>

                {sr.errors && sr.errors.length > 0 && (
                  <div style={{ padding: "10px 13px", borderRadius: 10, marginBottom: 14, border: "1px solid rgba(255,139,139,0.16)", background: "rgba(255,139,139,0.04)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ff8b8b", marginBottom: 5 }}>
                      {sr.errors.length} partial error(s)
                    </div>
                    {sr.errors.slice(0, 2).map((e, i) => (
                      <div key={i} style={{ fontSize: 11, color: MUTED }}>· {e}</div>
                    ))}
                  </div>
                )}

                {sr.synced === 0 && (
                  <div style={{ padding: "10px 13px", borderRadius: 10, marginBottom: 14, border: "1px solid rgba(241,195,95,0.16)", background: "rgba(241,195,95,0.04)" }}>
                    <div style={{ fontSize: 12, color: "#f1c35f", lineHeight: 1.6 }}>
                      No campaign data found for today — your credentials may be valid but no campaigns ran yet.
                    </div>
                  </div>
                )}

                <Cta onClick={onNext}>
                  Continue <ArrowRight size={14} />
                </Cta>
              </Card>

              <Card>
                <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                  What&apos;s ready
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <Row label="Campaigns"  tag={sr.synced > 0 ? "Imported" : "No data"} v={sr.synced > 0 ? "ok"   : "warn"   } />
                  <Row label="Spend"      tag={sr.synced > 0 ? "Imported" : "No data"} v={sr.synced > 0 ? "ok"   : "warn"   } />
                  <Row label="Revenue"    tag="Waiting for postback"                    v="warn"                               />
                  <Row label="Engine"     tag="Next step"                               v="neutral"                            />
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <Card>
                <p style={{ margin: "0 0 16px", color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
                  {errMsg ?? "Couldn't reach your networks right now. You can sync later from the Campaigns page — it won't block setup."}
                </p>
                <Cta onClick={onNext}>
                  Continue anyway <ArrowRight size={14} />
                </Cta>
              </Card>
              <Card>
                <div style={{ display: "grid", gap: 10 }}>
                  <Row label="Campaigns"  tag="Unavailable" v="bad"    />
                  <Row label="Spend"      tag="Unavailable" v="bad"    />
                  <Row label="Revenue"    tag="Waiting"     v="neutral" />
                  <Row label="Engine"     tag="Next step"   v="neutral" />
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step 5: Workspace ready ──────────────────────────────────────────────────

function Step5({
  onNext,
  syncResult,
  connectedNetworks,
}: {
  onNext: () => void;
  syncResult: SyncResult | null;
  connectedNetworks: Set<NetworkId>;
}) {
  const [signal, setSignal] = useState<RevenueSignal | null>(null);

  useEffect(() => {
    fetch("/api/revenue/signal")
      .then(r => r.json())
      .then((d: RevenueSignal) => setSignal(d))
      .catch(() => setSignal({ hasRevenue: false, postbackCount: 0, postbackRevenue: 0, campaignRevenue: 0 }));
  }, []);

  const hasRevenue = signal?.hasRevenue  ?? false;
  const campaigns  = syncResult?.synced  ?? 0;
  const hasNetwork = connectedNetworks.size > 0;
  const hasSpend   = campaigns > 0;
  const isReady    = hasNetwork && hasSpend && hasRevenue;
  const isPartial  = hasNetwork || hasSpend;

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: MUTED }}>
          {isReady ? "Workspace ready" : isPartial ? "Almost ready" : "Setup incomplete"}
        </span>
      </div>
      <h2 style={{ margin: "0 0 24px", fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 700, letterSpacing: "-0.04em", color: TEXT }}>
        {isReady ? "You're ready." : isPartial ? "Almost there." : "Nothing connected yet."}
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 18 }}>
        <Card>
          <p style={{ margin: "0 0 18px", color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
            {isReady
              ? "Revenue signal is live. The engine can make data-driven decisions — kill underperformers, scale winners."
              : isPartial
              ? "Spend data is coming in. Set up your postback to unlock profit-based decisions."
              : "You can finish setup from Settings → Connections. The engine runs in Recommend mode until data is connected."
            }
          </p>

          {!isReady && signal !== null && (
            <div style={{
              padding: "12px 15px", borderRadius: 12, marginBottom: 18,
              border: `1px solid ${!isPartial ? "rgba(124,108,255,0.18)" : "rgba(241,195,95,0.18)"}`,
              background: !isPartial ? "rgba(124,108,255,0.05)" : "rgba(241,195,95,0.04)",
            }}>
              <div style={{ fontSize: 12, color: !isPartial ? "rgba(196,181,253,0.80)" : "#f1c35f", lineHeight: 1.6 }}>
                {!isPartial
                  ? "Nothing connected. Finish setup from Settings → Connections at any time."
                  : "No revenue signal yet. The engine will suggest actions but won't execute until postback is live."
                }
              </div>
            </div>
          )}

          <Cta onClick={onNext}>
            {isReady ? "Activate the engine" : "Set up engine"} <ArrowRight size={14} />
          </Cta>
        </Card>

        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Workspace status
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <Row
              label="Ad network"
              tag={hasNetwork ? hasSpend ? "Connected · synced" : "Connected" : "Not connected"}
              v={hasNetwork ? "ok" : "neutral"}
            />
            <Row
              label="Spend data"
              tag={hasSpend ? `${campaigns} records` : "No data"}
              v={hasSpend ? "ok" : "neutral"}
            />
            <Row
              label="Revenue signal"
              tag={hasRevenue ? "Live" : "Not detected"}
              v={hasRevenue ? "ok" : "warn"}
            />
            <Row
              label="Decision Engine"
              tag={hasRevenue ? "Ready" : "Recommend mode"}
              v={hasRevenue ? "ok" : "neutral"}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Step 6: Decision Engine ──────────────────────────────────────────────────

function Step6({ onFinish }: { onFinish: (mode: "recommendation" | "automatic" | "skipped") => void }) {
  const [selected, setSelected] = useState<"recommendation" | "automatic">("recommendation");
  const [signal, setSignal]     = useState<boolean | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/revenue/signal")
      .then(r => r.json())
      .then((d: RevenueSignal) => setSignal(d.hasRevenue))
      .catch(() => setSignal(false));
  }, []);

  const hasRevenue   = signal ?? false;
  const isAutoLocked = !hasRevenue;

  async function activate() {
    setSaving(true);
    setSaveErr(null);
    try {
      // Use /api/settings PATCH-style PUT — only sends engineMode, preserves other fields
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineMode: selected }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveErr((d as { error?: string }).error ?? "Save failed — you can change this in Decision Rules later.");
        setSaving(false);
        return;
      }
    } catch {
      setSaveErr("Network error — you can change this in Decision Rules later.");
      setSaving(false);
      return;
    }
    await fetch("/api/user/welcome", { method: "POST" }).catch(() => {});
    onFinish(selected);
  }

  async function skip() {
    // Mark as welcomed without saving a specific engine mode (defaults apply)
    await fetch("/api/user/welcome", { method: "POST" }).catch(() => {});
    onFinish("skipped");
  }

  const MODES: Array<{
    id: "recommendation" | "automatic";
    label: string;
    items: string[];
    variant: "rec" | "auto";
    locked?: boolean;
  }> = [
    {
      id: "recommendation",
      label: "Recommend",
      items: ["Reviews each action with you", "Suggested kills & scales", "Safe for getting started"],
      variant: "rec",
    },
    {
      id: "automatic",
      label: "Automatic",
      items: ["Executes rules without asking", "Balanced preset by default", "Requires live revenue signal"],
      variant: "auto",
      locked: isAutoLocked,
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: MUTED }}>Step 4 of 4</span>
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: "clamp(24px,3.5vw,36px)", fontWeight: 700, letterSpacing: "-0.04em", color: TEXT }}>
        Decision Engine ready.
      </h2>
      <p style={{ margin: "0 0 20px", color: MUTED, fontSize: 13, lineHeight: 1.6, maxWidth: "52ch" }}>
        Choose how the engine behaves. You can change this anytime in Settings.
      </p>

      {/* Progress bar */}
      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 24, maxWidth: 900 }}>
        <div style={{ height: "100%", width: selected === "automatic" ? "100%" : "68%", background: `linear-gradient(90deg,${ACCENT},${ACCENT2})`, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>

      {/* Mode cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
        {MODES.map(mode => {
          const isSelected = selected === mode.id && !mode.locked;
          return (
            <div
              key={mode.id}
              onClick={() => !mode.locked && setSelected(mode.id)}
              style={{
                border: `1px solid ${isSelected
                  ? mode.id === "recommendation" ? "rgba(124,108,255,0.40)" : "rgba(52,211,153,0.35)"
                  : LINE}`,
                borderRadius: 22, padding: 22,
                background: isSelected
                  ? mode.id === "recommendation"
                    ? "linear-gradient(180deg,rgba(124,108,255,0.13),rgba(124,108,255,0.04))"
                    : "linear-gradient(180deg,rgba(52,211,153,0.10),rgba(52,211,153,0.03))"
                  : "rgba(255,255,255,0.02)",
                cursor: mode.locked ? "not-allowed" : "pointer",
                opacity: mode.locked ? 0.45 : 1,
                transition: "all 0.2s",
                position: "relative" as const,
              }}
            >
              {/* Radio */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  border: isSelected
                    ? `5px solid ${mode.id === "recommendation" ? ACCENT : "#34d399"}`
                    : `2px solid rgba(255,255,255,0.20)`,
                  transition: "all 0.2s",
                }} />
                <strong style={{ fontSize: 15, color: mode.locked ? MUTED : TEXT, fontWeight: 700 }}>
                  {mode.label}
                </strong>
                {mode.locked && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const,
                    color: MUTED, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)",
                    borderRadius: 6, padding: "2px 8px",
                  }}>
                    <Lock size={8} /> Needs revenue signal
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {mode.items.map((item, i) => (
                  <div key={i} style={{
                    border: `1px solid ${LINE}`, borderRadius: 12,
                    padding: "9px 12px", background: "rgba(255,255,255,0.02)",
                    fontSize: 12, color: mode.locked ? "rgba(255,255,255,0.25)" : MUTED,
                  }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {saveErr && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, fontSize: 12, background: "rgba(255,139,139,0.07)", border: "1px solid rgba(255,139,139,0.18)", color: "#ff8b8b", lineHeight: 1.6 }}>
          {saveErr}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 0 }}>
        <Cta onClick={activate} loading={saving}>
          <Zap size={14} /> Activate engine
        </Cta>
        <Cta onClick={skip} variant="ghost">
          Skip for now
        </Cta>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
        You can change engine mode at any time in Decision Rules.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [connectedNetworks, setConnectedNetworks] = useState<Set<NetworkId>>(new Set());
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS)); }

  async function handleFinish(mode: "recommendation" | "automatic" | "skipped") {
    void mode; // already saved in Step6.activate() (or skipped intentionally)
    router.push("/dashboard");
  }

  return (
    <Shell step={step}>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: EASE }} style={{ width: "100%" }}>
            <Step1 onNext={next} />
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: EASE }} style={{ width: "100%" }}>
            <Step2 onNext={next} connectedNetworks={connectedNetworks} setConnectedNetworks={setConnectedNetworks} />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: EASE }} style={{ width: "100%" }}>
            <Step3 onNext={next} />
          </motion.div>
        )}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: EASE }} style={{ width: "100%" }}>
            <Step4 onNext={next} syncResult={syncResult} setSyncResult={setSyncResult} />
          </motion.div>
        )}
        {step === 5 && (
          <motion.div key="s5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: EASE }} style={{ width: "100%" }}>
            <Step5 onNext={next} syncResult={syncResult} connectedNetworks={connectedNetworks} />
          </motion.div>
        )}
        {step === 6 && (
          <motion.div key="s6" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.28, ease: EASE }} style={{ width: "100%" }}>
            <Step6 onFinish={handleFinish} />
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
