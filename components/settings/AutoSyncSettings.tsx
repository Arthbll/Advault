"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Clock } from "lucide-react";

const INTERVALS = [
  { value: 0,  label: "Désactivé" },
  { value: 1,  label: "Toutes les heures" },
  { value: 4,  label: "Toutes les 4 heures" },
  { value: 12, label: "Toutes les 12 heures" },
  { value: 24, label: "Une fois par jour" },
];

function fmtLastSync(iso: string | null) {
  if (!iso) return "Jamais synchronisé";
  const d    = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1)  return "À l'instant";
  if (diff < 60) return `Il y a ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function AutoSyncSettings() {
  const [interval,  setIntervalVal] = useState(0);
  const [lastSync,  setLastSync]    = useState<string | null>(null);
  const [saved,     setSaved]       = useState(false);

  useEffect(() => {
    setIntervalVal(Number(localStorage.getItem("autoSyncInterval") ?? 0));
    setLastSync(localStorage.getItem("lastSyncAt"));
  }, []);

  function save(val: number) {
    setIntervalVal(val);
    localStorage.setItem("autoSyncInterval", String(val));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputBase: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 14, outline: "none",
    background: "#1A1A1C", border: "1.5px solid rgba(255,255,255,0.06)",
    color: "#E4E4E7", transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
    boxSizing: "border-box", appearance: "none" as const,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      style={{
        background: "#111113", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: interval > 0 ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.04)",
          border: interval > 0 ? "1px solid rgba(0,255,135,0.15)" : "1px solid rgba(255,255,255,0.06)",
          transition: "all 0.3s",
        }}>
          <RefreshCw size={16} strokeWidth={1.5} style={{
            color: interval > 0 ? "#00FF87" : "#3F3F46",
            filter: interval > 0 ? "drop-shadow(0 0 5px rgba(0,255,135,0.6))" : "none",
            transition: "all 0.3s",
          }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>Auto-Sync</p>
          <p style={{ fontSize: 12, color: interval > 0 ? "#00FF87" : "#3F3F46", marginTop: 2, transition: "color 0.3s" }}>
            {interval > 0 ? `Actif — ${INTERVALS.find(i => i.value === interval)?.label.toLowerCase()}` : "Désactivé"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Interval selector */}
        <div>
          <label style={{ fontSize: 12, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, display: "block", marginBottom: 7 }}>
            Fréquence
          </label>
          <select
            value={interval}
            onChange={e => save(Number(e.target.value))}
            style={inputBase}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)"; e.currentTarget.style.background = "#111113"; }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "#1A1A1C"; }}
          >
            {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        {/* Last sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "#1A1A1C", border: "1px solid rgba(255,255,255,0.04)" }}>
          <Clock size={12} strokeWidth={1.5} style={{ color: "#3F3F46", flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#3F3F46", margin: 0 }}>
            Dernière sync : <span style={{ color: "#52525B" }}>{fmtLastSync(lastSync)}</span>
          </p>
        </div>

        {/* Saved feedback */}
        {saved && (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ fontSize: 12, color: "#00FF87", margin: 0, textAlign: "center" }}
          >
            ✓ Sauvegardé
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
