"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Check, AlertTriangle } from "lucide-react";

type Permission = "default" | "granted" | "denied";

const PREFS_KEY = "notifPrefs";

interface NotifPrefs {
  onSync:       boolean;
  onKillSwitch: boolean;
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { onSync: true, onKillSwitch: true };
}

export function sendNotification(title: string, body: string, type: keyof NotifPrefs) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const prefs: NotifPrefs = loadPrefs();
    if (!prefs[type]) return;
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `advault-${type}`,
    });
  } catch {}
}

export default function NotificationSettings() {
  const [mounted,    setMounted]    = useState(false);
  const [permission, setPermission] = useState<Permission>("default");
  const [prefs,      setPrefs]      = useState<NotifPrefs>({ onSync: true, onKillSwitch: true });
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if ("Notification" in window) {
      setPermission(Notification.permission as Permission);
    }
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
      transition={{ duration: 0.3, delay: 0.1 }}
      style={{
        background: "#111113", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isGranted ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.04)",
            border: isGranted ? "1px solid rgba(0,255,135,0.15)" : "1px solid rgba(255,255,255,0.06)",
            transition: "all 0.3s",
          }}>
            {isGranted
              ? <Bell size={16} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 5px rgba(0,255,135,0.6))", transition: "all 0.3s" }} />
              : <BellOff size={16} strokeWidth={1.5} style={{ color: "#3F3F46" }} />
            }
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>Notifications</p>
            <p style={{ fontSize: 12, color: isGranted ? "#00FF87" : "#3F3F46", marginTop: 2, transition: "color 0.3s" }}>
              {isGranted ? "Activées" : isDenied ? "Bloquées par le navigateur" : "Non autorisées"}
            </p>
          </div>
        </div>

        {/* Status badge */}
        {isGranted && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: "rgba(0,255,135,0.08)", color: "#00FF87",
            border: "1px solid rgba(0,255,135,0.15)",
          }}>
            <Check size={10} strokeWidth={2.5} /> Actif
          </div>
        )}
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Not supported */}
        {!isSupported && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 14px", borderRadius: 12, fontSize: 12,
            background: "rgba(255,69,58,0.06)", color: "#FF453A",
            border: "1px solid rgba(255,69,58,0.12)",
          }}>
            <AlertTriangle size={12} strokeWidth={1.5} />
            Navigateur non compatible
          </div>
        )}

        {/* Denied warning */}
        <AnimatePresence>
          {isDenied && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{
                padding: "11px 14px", borderRadius: 12, fontSize: 12, lineHeight: 1.6,
                background: "rgba(255,69,58,0.06)", color: "#FF453A",
                border: "1px solid rgba(255,69,58,0.12)",
              }}
            >
              Notifications bloquées. Clique sur le cadenas dans la barre d&apos;adresse et autorise les notifications.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Request permission button */}
        {!isGranted && !isDenied && isSupported && (
          <motion.button
            whileHover={{ y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" }}
            whileTap={{ scale: 0.97 }}
            onClick={requestPermission}
            disabled={requesting}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: 14, fontSize: 13, fontWeight: 600,
              background: "rgba(0,255,135,0.1)", color: "#00FF87",
              border: "1px solid rgba(0,255,135,0.25)",
              cursor: requesting ? "not-allowed" : "pointer", opacity: requesting ? 0.7 : 1,
              transition: "box-shadow 0.15s",
            }}
          >
            <Bell size={13} strokeWidth={1.5} />
            {requesting ? "En attente…" : "Autoriser les notifications"}
          </motion.button>
        )}

        {/* Toggles — only shown when granted */}
        <AnimatePresence>
          {isGranted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {([
                { key: "onSync"       as const, label: "Sync terminée",              desc: "Quand l'auto-sync se termine"   },
                { key: "onKillSwitch" as const, label: "Kill-Switch déclenché",       desc: "Quand une campagne est stoppée" },
              ]).map(({ key, label, desc }) => (
                <div
                  key={key}
                  onClick={() => togglePref(key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                    background: prefs[key] ? "rgba(0,255,135,0.04)" : "#1A1A1C",
                    border: `1px solid ${prefs[key] ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.04)"}`,
                    transition: "all 0.2s",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#E4E4E7", margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 11, color: "#3F3F46", margin: 0, marginTop: 2 }}>{desc}</p>
                  </div>
                  {/* Mini toggle */}
                  <div style={{
                    position: "relative", width: 38, height: 22, borderRadius: 99, flexShrink: 0,
                    background: prefs[key] ? "#00FF87" : "#27272A",
                    transition: "background 0.25s",
                    boxShadow: prefs[key] ? "0 0 8px rgba(0,255,135,0.35)" : "none",
                  }}>
                    <motion.div
                      animate={{ left: prefs[key] ? 18 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      style={{
                        position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%",
                        background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      }}
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
