"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Lock, CheckCircle, AlertCircle, Loader, ArrowRight, ChevronDown } from "lucide-react";
import { saveAccount, disconnectAccount } from "@/app/actions/accounts";
import { Network } from "@prisma/client";

interface Props {
  network: Network;
  label: string;
  description: string;
  color: string;
  glow: string;
  hasSecret: boolean;
  secretLabel?: string;
  keyLabel?: string;
  isConnected: boolean;
  index: number;
}

// ─── Tone map for network badges ──────────────────────────────────────────────
const NETWORK_TONE: Record<string, { border: string; bg: string; text: string }> = {
  EXOCLICK:     { border: "rgba(251,191,36,0.18)",  bg: "rgba(245,158,11,0.10)",  text: "rgba(253,230,138,1)"  },
  TRAFFICSTARS: { border: "rgba(167,139,250,0.18)", bg: "rgba(139,92,246,0.10)",  text: "rgba(221,214,254,1)"  },
  TRAFFICJUNKY: { border: "rgba(56,189,248,0.18)",  bg: "rgba(14,165,233,0.10)",  text: "rgba(186,230,253,1)"  },
  PROPELLERADS: { border: "rgba(249,115,22,0.18)",  bg: "rgba(249,115,22,0.10)",  text: "rgba(254,215,170,1)"  },
  ADSTERRA:     { border: "rgba(6,182,212,0.18)",   bg: "rgba(6,182,212,0.10)",   text: "rgba(165,243,252,1)"  },
};

const CONNECTED_STYLE = {
  border: "rgba(52,211,153,0.18)", bg: "rgba(16,185,129,0.10)", text: "rgba(167,243,208,1)",
};
const PENDING_STYLE = {
  border: "rgba(251,191,36,0.16)", bg: "rgba(245,158,11,0.08)", text: "rgba(253,230,138,1)",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px 10px 36px",
  borderRadius: 12,
  fontSize: 13,
  outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.85)",
  transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box",
  fontFamily: "monospace",
  colorScheme: "dark",
};

function SmallBtn({
  children, onClick, danger, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        borderRadius: 10,
        border: danger ? "1px solid rgba(251,113,133,0.16)" : "1px solid rgba(255,255,255,0.10)",
        background: danger ? "rgba(244,63,94,0.06)" : "rgba(255,255,255,0.03)",
        color: danger ? "rgba(254,205,211,0.80)" : "rgba(255,255,255,0.65)",
        padding: "7px 14px",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function NetworkCard({
  network,
  label,
  description,
  hasSecret,
  secretLabel,
  keyLabel,
  isConnected: initConnected,
  index,
}: Props) {
  const router     = useRouter();
  const inputRef   = useRef<HTMLInputElement>(null);

  const [connected, setConnected]   = useState(initConnected);
  const [editing, setEditing]       = useState(false);
  const [apiKey, setApiKey]         = useState("");
  const [apiSecret, setApiSecret]   = useState("");
  const [isPending, setIsPending]   = useState(false);
  const [isSyncing, setIsSyncing]   = useState(false);
  const [feedback, setFeedback]     = useState<{
    type: "success" | "error";
    msg: string;
    synced?: boolean;
  } | null>(null);

  const netTone = NETWORK_TONE[network] ?? NETWORK_TONE.EXOCLICK;

  // Derive richer status from state
  const syncState: "syncing" | "connected" | "error" | "not-connected" = isSyncing
    ? "syncing"
    : connected
    ? "connected"
    : feedback?.type === "error"
    ? "error"
    : "not-connected";

  const STATUS_STYLES = {
    connected:     CONNECTED_STYLE,
    syncing:       { border: "rgba(56,189,248,0.18)", bg: "rgba(14,165,233,0.10)", text: "rgba(186,230,253,1)" },
    error:         { border: "rgba(251,113,133,0.18)", bg: "rgba(244,63,94,0.08)", text: "rgba(254,205,211,1)" },
    "not-connected": PENDING_STYLE,
  };
  const STATUS_LABELS = {
    connected:     "Connected",
    syncing:       "Syncing",
    error:         "Error",
    "not-connected": "Not connected",
  };
  const STATUS_SUBS = {
    connected:     "API healthy · idle",
    syncing:       "Importing campaigns…",
    error:         "Could not reach API — check your credentials",
    "not-connected": "Click Configure to add your credentials",
  };

  const statusTone  = STATUS_STYLES[syncState];
  const statusLabel = STATUS_LABELS[syncState];
  const statusSub   = STATUS_SUBS[syncState];

  function openEdit() {
    setEditing(true);
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  function cancelEdit() {
    setEditing(false);
    setApiKey("");
    setApiSecret("");
    setFeedback(null);
  }

  async function handleSave() {
    setFeedback(null);
    setIsPending(true);
    try {
      const fd = new FormData();
      fd.set("network", String(network));
      fd.set("apiKey", apiKey);
      if (hasSecret) fd.set("apiSecret", apiSecret);

      const result = await saveAccount(fd);
      if (result?.error) {
        setFeedback({ type: "error", msg: result.error });
      }
      if (result?.success) {
        setConnected(true);
        setEditing(false);
        setApiKey("");
        setApiSecret("");
        setIsSyncing(true);
        setFeedback({ type: "success", msg: "Credentials saved — importing campaigns…" });

        fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "daily", network }),
        })
          .then(r => r.json())
          .then((data: { synced?: number }) => {
            setIsSyncing(false);
            const count = data.synced ?? 0;
            setFeedback({
              type: "success",
              msg: count > 0
                ? `${count} campaign(s) synced — all set.`
                : "Connected — no active campaigns found for today.",
              synced: true,
            });
            router.refresh();
          })
          .catch(() => {
            setIsSyncing(false);
            setFeedback({ type: "success", msg: "Connected — campaigns will be visible after the next sync.", synced: true });
          });
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleDisconnect() {
    setFeedback(null);
    setIsPending(true);
    try {
      const result = await disconnectAccount(network);
      if (result?.error) setFeedback({ type: "error", msg: result.error });
      if (result?.success) {
        setFeedback({ type: "success", msg: result.success });
        setConnected(false);
        setEditing(false);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay: index * 0.09, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg,rgba(17,18,25,0.98),rgba(12,13,19,0.98))",
        overflow: "hidden",
      }}
    >
      {/* ── Collapsed row ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 20, padding: "20px 22px",
      }}>
        {/* Left: badges + name + sub */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{
              display: "inline-flex", borderRadius: 9999,
              border: `1px solid ${netTone.border}`,
              padding: "3px 12px", fontSize: 10, textTransform: "uppercase",
              letterSpacing: "0.22em", background: netTone.bg, color: netTone.text,
            }}>
              {label}
            </span>
            <span style={{
              display: "inline-flex", borderRadius: 9999,
              border: `1px solid ${statusTone.border}`,
              padding: "3px 12px", fontSize: 10, textTransform: "uppercase",
              letterSpacing: "0.22em", background: statusTone.bg, color: statusTone.text,
            }}>
              {statusLabel}
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.92)" }}>
            {label} connection
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginTop: 6 }}>
            {statusSub}
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {!editing && (
            <>
              <SmallBtn onClick={openEdit} disabled={isPending}>
                {connected ? "Edit" : "Configure"}
              </SmallBtn>
              {connected && (
                <SmallBtn onClick={handleDisconnect} danger disabled={isPending}>
                  {isPending ? "…" : "Disconnect"}
                </SmallBtn>
              )}
              {/* Expand chevron */}
              <button
                onClick={() => setEditing(v => !v)}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "rgba(255,255,255,0.36)",
                  transition: "transform 0.2s",
                }}
              >
                <ChevronDown size={14} strokeWidth={1.4} />
              </button>
            </>
          )}
          {editing && (
            <SmallBtn onClick={cancelEdit}>Cancel</SmallBtn>
          )}
        </div>
      </div>

      {/* ── Feedback banner ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              margin: "0 22px 16px",
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 14, fontSize: 12,
              background: feedback.type === "success" ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
              color: feedback.type === "success" ? "#6b9e82" : "#a07070",
              border: `1px solid ${feedback.type === "success" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)"}`,
            }}>
              {isSyncing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                  <Loader size={11} strokeWidth={1.3} />
                </motion.div>
              ) : feedback.type === "success" ? (
                <CheckCircle size={11} strokeWidth={1.3} />
              ) : (
                <AlertCircle size={11} strokeWidth={1.3} />
              )}
              <span style={{ flex: 1 }}>{feedback.msg}</span>
              {feedback.synced && !isSyncing && (
                <button
                  onClick={() => router.push("/dashboard")}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 7, border: "none",
                    background: "rgba(74,222,128,0.15)", color: "#6b9e82",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                  }}
                >
                  Dashboard <ArrowRight size={10} strokeWidth={1.4} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expandable form ── */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              padding: "0 22px 22px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 20,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* API Key field */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.30)" }}>
                    {keyLabel ?? "API Key"}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Key size={11} strokeWidth={1.3} style={{
                      position: "absolute", left: 12, top: "50%",
                      transform: "translateY(-50%)", color: "#52525b", pointerEvents: "none",
                    }} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      autoComplete="off"
                      placeholder="••••••••••••••••"
                      style={INPUT}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    />
                  </div>
                </div>

                {/* Secret field (optional) */}
                {hasSecret && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.30)" }}>
                      {secretLabel ?? "API Secret"}
                    </label>
                    <div style={{ position: "relative" }}>
                      <Lock size={11} strokeWidth={1.3} style={{
                        position: "absolute", left: 12, top: "50%",
                        transform: "translateY(-50%)", color: "#52525b", pointerEvents: "none",
                      }} />
                      <input
                        type="text"
                        value={apiSecret}
                        onChange={e => setApiSecret(e.target.value)}
                        autoComplete="off"
                        placeholder="••••••••••••••••"
                        style={INPUT}
                        onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      />
                    </div>
                  </div>
                )}

                {/* Save button */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleSave}
                    disabled={isPending || !apiKey.trim()}
                    style={{
                      borderRadius: 16, border: "none",
                      background: "linear-gradient(90deg,#ec4899,#8b5cf6,#6366f1)",
                      color: "#fff", padding: "10px 24px",
                      fontSize: 13, fontWeight: 600,
                      cursor: isPending || !apiKey.trim() ? "not-allowed" : "pointer",
                      opacity: isPending || !apiKey.trim() ? 0.5 : 1,
                      boxShadow: "0 8px 24px rgba(139,92,246,0.30)",
                      display: "flex", alignItems: "center", gap: 8,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {isPending ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}>
                          <Loader size={12} strokeWidth={1.3} />
                        </motion.div>
                        Saving…
                      </>
                    ) : (
                      "Save credentials"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
