"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Check, AlertTriangle } from "lucide-react";

type Permission = "default" | "granted" | "denied";

const PREFS_KEY = "notifPrefs";
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.28)",
};

interface NotifPrefs { onSync: boolean; onKillSwitch: boolean; }

function loadPrefs(): NotifPrefs {
  try { const raw = localStorage.getItem(PREFS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return { onSync: true, onKillSwitch: true };
}

export function sendNotification(title: string, body: string, type: keyof NotifPrefs) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const prefs: NotifPrefs = loadPrefs();
    if (!prefs[type]) return;
    new Notification(title, { body, icon: "/favicon.ico", tag: `profitdash-${type}` });
  } catch {}
}

export default function NotificationSettings() {
  const [mounted,    setMounted]    = useState(false);
  const [permission, setPermission] = useState<Permission>("default");
  const [prefs,      setPrefs]      = useState<NotifPrefs>({ onSync: true, onKillSwitch: true });
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if ("Notification" in window) setPermission(Notification.permission as Permission);
    setPrefs(loadPrefs());
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) return;
    setRequesting(true);
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    setRequesting(false);
  }

  function togglePref(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  const isSupported = mounted && "Notification" in window;
  const isGranted   = permission === "granted";
  const isDenied    = permission === "denied";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      style={{
        background: "rgba(255,255,255,0.03)", borderRadius: 18, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isGranted ? "rgba(107,158,130,0.1)" : "rgba(255,255,255,0.04)",
            transition: "background 0.25s",
          }}>
            {isGranted
              ? <Bell size={14} strokeWidth={1.5} style={{ color: "#6b9e82", transition: "color 0.25s" }} />
              : <BellOff size={14} strokeWidth={1.5} style={{ color: "#3f3f46" }} />}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>Notifications</p>
            <p style={{ ...LABEL, marginTop: 2, color: isGranted ? "#6b9e82" : "#3f3f46", transition: "color 0.25s" }}>
              {isGranted ? "Enabled" : isDenied ? "Blocked" : "Not authorised"}
            </p>
          </div>
        </div>
        {isGranted && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "rgba(107,158,130,0.08)", color: "#6b9e82", border: "1px solid rgba(107,158,130,0.15)" }}>
            <Check size={9} strokeWidth={2.5} /> Active
          </span>
        )}
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!isSupported && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, fontSize: 12, background: "rgba(160,112,112,0.06)", color: "#a07070", border: "1px solid rgba(160,112,112,0.1)" }}>
            <AlertTriangle size={11} strokeWidth={1.5} /> Browser not supported
          </div>
        )}

        <AnimatePresence>
          {isDenied && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ padding: "10px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.6, background: "rgba(160,112,112,0.06)", color: "#a07070", border: "1px solid rgba(160,112,112,0.1)" }}>
              Notifications blocked. Enable them via the lock icon in the address bar.
            </motion.div>
          )}
        </AnimatePresence>

        {!isGranted && !isDenied && isSupported && (
          <button onClick={requestPermission} disabled={requesting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px", borderRadius: 12, fontSize: 12, fontWeight: 500,
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: requesting ? "not-allowed" : "pointer", opacity: requesting ? 0.7 : 1,
              transition: "background 0.15s",
            }}>
            <Bell size={12} strokeWidth={1.5} />
            {requesting ? "Requesting…" : "Allow notifications"}
          </button>
        )}

        <AnimatePresence>
          {isGranted && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {([
                { key: "onSync"       as const, label: "Sync complete",      desc: "When auto-sync finishes"        },
                { key: "onKillSwitch" as const, label: "Engine action fired", desc: "When a campaign is stopped"     },
              ]).map(({ key, label, desc }) => (
                <div key={key} onClick={() => togglePref(key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 13px", borderRadius: 10, cursor: "pointer",
                    background: prefs[key] ? "rgba(107,158,130,0.04)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${prefs[key] ? "rgba(107,158,130,0.1)" : "rgba(255,255,255,0.04)"}`,
                    transition: "all 0.2s",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)", margin: 0 }}>{label}</p>
                    <p style={{ ...LABEL, marginTop: 2 }}>{desc}</p>
                  </div>
                  <div style={{
                    position: "relative", width: 36, height: 20, borderRadius: 99, flexShrink: 0,
                    background: prefs[key] ? "#6b9e82" : "rgba(255,255,255,0.08)",
                    transition: "background 0.25s",
                  }}>
                    <motion.div
                      animate={{ left: prefs[key] ? 17 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      style={{ position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
