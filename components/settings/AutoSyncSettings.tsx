"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Clock } from "lucide-react";

const INTERVALS = [
  { value: 0,  label: "Disabled"        },
  { value: 1,  label: "Every hour"      },
  { value: 4,  label: "Every 4 hours"   },
  { value: 12, label: "Every 12 hours"  },
  { value: 24, label: "Once per day"    },
];

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "#3f3f46",
};

function fmtLastSync(iso: string | null) {
  if (!iso) return "Never synced";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return "Just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
}

export default function AutoSyncSettings() {
  const [interval, setIntervalVal] = useState(0);
  const [lastSync, setLastSync]    = useState<string | null>(null);
  const [saved,    setSaved]       = useState(false);
  const [syncing,  setSyncing]     = useState(false);
  const [syncMsg,  setSyncMsg]     = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json() as { synced?: number; errors?: string[] };
      const now  = new Date().toISOString();
      localStorage.setItem("lastSyncAt", now);
      setLastSync(now);
      setSyncMsg(data.errors?.length ? `⚠ ${data.errors[0]}` : `✓ ${data.synced ?? 0} record(s) synced`);
    } catch (e) {
      setSyncMsg("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  }

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

  const SELECT: React.CSSProperties = {
    width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 13, outline: "none",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.85)", boxSizing: "border-box",
    transition: "border-color 0.15s", colorScheme: "dark", appearance: "none",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      style={{
        background: "#17171e", borderRadius: 18, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.03)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 2px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: interval > 0 ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
          transition: "background 0.25s",
        }}>
          <RefreshCw size={14} strokeWidth={1.5} style={{ color: interval > 0 ? "#6b9e82" : "#3f3f46", transition: "color 0.25s" }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>Auto-Sync</p>
          <p style={{ ...LABEL, marginTop: 2, color: interval > 0 ? "#6b9e82" : "#3f3f46", transition: "color 0.25s" }}>
            {interval > 0 ? INTERVALS.find(i => i.value === interval)?.label.toLowerCase() : "Disabled"}
          </p>
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ ...LABEL, display: "block", marginBottom: 6 }}>Frequency</label>
          <select value={interval} onChange={e => save(Number(e.target.value))} style={SELECT}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <Clock size={11} strokeWidth={1.5} style={{ color: "#3f3f46", flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: "#3f3f46", margin: 0 }}>
            Last sync: <span style={{ color: "rgba(255,255,255,0.3)" }}>{fmtLastSync(lastSync)}</span>
          </p>
        </div>

        <button
          onClick={syncNow}
          disabled={syncing}
          style={{
            width: "100%", padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 600,
            border: "1px solid rgba(255,255,255,0.08)", cursor: syncing ? "not-allowed" : "pointer",
            background: syncing ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
            color: syncing ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            transition: "all 0.15s",
          }}
        >
          <RefreshCw size={12} strokeWidth={1.5} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>

        {syncMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontSize: 11, color: syncMsg.startsWith("⚠") ? "#e88c6a" : "#6b9e82", margin: 0, textAlign: "center" }}>
            {syncMsg}
          </motion.p>
        )}

        {saved && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ fontSize: 11, color: "#6b9e82", margin: 0, textAlign: "center" }}>
            ✓ Saved
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
