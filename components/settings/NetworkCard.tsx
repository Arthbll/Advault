"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Lock, CheckCircle, AlertCircle, Unplug, Loader } from "lucide-react";
import { saveAccount, disconnectAccount } from "@/app/actions/accounts";
import { Network } from "@prisma/client";

interface Props {
  network: Network; label: string; description: string;
  color: string; glow: string; hasSecret: boolean;
  secretLabel?: string; keyLabel?: string;
  isConnected: boolean; index: number;
}

// Extract RGB from hex for rgba usage
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

export default function NetworkCard({ network, label, description, color, hasSecret, secretLabel, keyLabel, isConnected: initConnected, index }: Props) {
  const [connected, setConnected] = useState(initConnected);
  const [expanded,  setExpanded]  = useState(!initConnected);
  const [feedback,  setFeedback]  = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [hov,       setHov]       = useState(false);
  const [isPending, startTransition] = useTransition();

  const rgb = hexToRgb(color);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFeedback(null);
    const fd = new FormData(e.currentTarget); fd.set("network", network);
    startTransition(async () => {
      const result = await saveAccount(fd);
      if (result?.error)   setFeedback({ type: "error",   msg: result.error   });
      if (result?.success) { setFeedback({ type: "success", msg: result.success }); setConnected(true); setTimeout(() => setExpanded(false), 1200); }
    });
  }

  function handleDisconnect() {
    setFeedback(null);
    startTransition(async () => {
      const result = await disconnectAccount(network);
      if (result?.error)   setFeedback({ type: "error",   msg: result.error   });
      if (result?.success) { setFeedback({ type: "success", msg: result.success }); setConnected(false); setExpanded(true); }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: [0.23, 1, 0.32, 1] }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#111113",
        border: hov ? `1px solid rgba(${rgb},0.2)` : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20, overflow: "hidden",
        boxShadow: hov
          ? `0 0 0 1px rgba(${rgb},0.06), 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(${rgb},0.06)`
          : "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        transition: "border-color 0.2s, box-shadow 0.25s, transform 0.18s",
      }}
    >
      {/* Top accent */}
      <div style={{ height: connected ? 2 : 1, background: connected ? `linear-gradient(90deg, transparent, rgba(${rgb},0.6), transparent)` : "rgba(255,255,255,0.04)" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color,
            background: `rgba(${rgb},0.1)`,
            border: `1px solid rgba(${rgb},0.15)`,
            letterSpacing: "0.03em",
            boxShadow: hov ? `0 0 10px rgba(${rgb},0.2)` : "none",
            transition: "box-shadow 0.2s",
          }}>
            {label.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>{label}</p>
            <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 2 }}>{description}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {connected && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280 }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, background: "rgba(0,255,135,0.08)", color: "#00FF87", fontSize: 11, fontWeight: 600, border: "1px solid rgba(0,255,135,0.15)" }}>
              <CheckCircle size={10} strokeWidth={2} style={{ filter: "drop-shadow(0 0 3px rgba(0,255,135,0.5))" }} /> Connecté
            </motion.div>
          )}
          <motion.button
            whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
            onClick={() => setExpanded(v => !v)}
            style={{
              padding: "6px 14px", borderRadius: 99,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)", color: "#52525B",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {expanded ? "Replier" : connected ? "Modifier" : "Configurer"}
          </motion.button>
        </div>
      </div>

      {/* Expandable form */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <form onSubmit={handleSave} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>

              {[
                { name: "apiKey",    label: keyLabel    ?? "API Key",    Icon: Key,  show: true      },
                { name: "apiSecret", label: secretLabel ?? "API Secret", Icon: Lock, show: hasSecret },
              ].filter(f => f.show).map(({ name, label: lbl, Icon }) => (
                <div key={name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#3F3F46" }}>
                    {lbl}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Icon size={11} strokeWidth={1.5} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3F3F46", pointerEvents: "none" }} />
                    <input
                      type="text" name={name}
                      required={name === "apiKey"}
                      autoComplete="off"
                      placeholder="••••••••••••••••"
                      style={{
                        width: "100%", paddingLeft: 38, paddingRight: 16, paddingTop: 12, paddingBottom: 12,
                        borderRadius: 12, fontSize: 13, fontFamily: "monospace", outline: "none",
                        background: "#1A1A1C", border: `1.5px solid rgba(255,255,255,0.06)`,
                        color: "#E4E4E7", transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
                        boxSizing: "border-box" as const,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = `rgba(${rgb},0.5)`; e.currentTarget.style.background = "#111113"; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${rgb},0.08)`; }}
                      onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "#1A1A1C"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>
              ))}

              <AnimatePresence>
                {feedback && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, fontSize: 13,
                      background: feedback.type === "success" ? "rgba(0,255,135,0.08)"  : "rgba(255,69,58,0.08)",
                      color:      feedback.type === "success" ? "#00FF87" : "#FF453A",
                      border: `1px solid ${feedback.type === "success" ? "rgba(0,255,135,0.15)" : "rgba(255,69,58,0.15)"}`,
                    }}
                  >
                    {feedback.type === "success" ? <CheckCircle size={11} strokeWidth={1.5} /> : <AlertCircle size={11} strokeWidth={1.5} />}
                    {feedback.msg}
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: "flex", gap: 8 }}>
                <motion.button
                  type="submit" disabled={isPending}
                  whileHover={!isPending ? { y: -1, boxShadow: `0 4px 14px rgba(${rgb},0.3)` } : {}}
                  whileTap={!isPending ? { scale: 0.97 } : {}}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "11px 20px", borderRadius: 12, border: "none",
                    background: color, color: color === "#00FF87" ? "#000000" : "#FFFFFF",
                    fontSize: 13, fontWeight: 700,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.6 : 1,
                    boxShadow: `0 2px 10px rgba(${rgb},0.35)`,
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {isPending
                    ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><Loader size={11} strokeWidth={1.5} /></motion.div>
                    : "Sauvegarder"
                  }
                </motion.button>

                {connected && (
                  <motion.button
                    type="button" disabled={isPending} onClick={handleDisconnect}
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "11px 16px", borderRadius: 12,
                      border: "1px solid rgba(255,69,58,0.15)",
                      background: "rgba(255,69,58,0.08)", color: "#FF453A",
                      fontSize: 13, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    <Unplug size={11} strokeWidth={1.5} /> Déconnecter
                  </motion.button>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
