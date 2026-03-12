"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Play, RefreshCw } from "lucide-react";
import { sendNotification } from "./NotificationSettings";

interface KSConfig {
  killSwitchEnabled: boolean; roiThreshold: number;
  maxSpendPerCampaign: number | null; checkIntervalMinutes: number;
}

interface Props { initialSettings: KSConfig; }

export default function KillSwitchSettings({ initialSettings }: Props) {
  const [cfg,     setCfg]     = useState<KSConfig>(initialSettings);
  const [saving,  setSaving]  = useState(false);
  const [running, setRunning] = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [lastRun, setLastRun] = useState<{ killed: number; checked: number; killedList?: string[] } | null>(null);

  function showToast(msg: string, ok: boolean) { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }

  async function save() {
    setSaving(true);
    try {
      const res  = await fetch("/api/settings/kill-switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const json = await res.json();
      json.ok ? showToast("Paramètres sauvegardés", true) : showToast(json.error ?? "Erreur", false);
    } catch { showToast("Erreur réseau", false); }
    setSaving(false);
  }

  async function runNow() {
    setRunning(true);
    try {
      const res  = await fetch("/api/cron/kill-switch", { method: "POST" });
      const json = await res.json();
      if (json.skipped) { showToast("Kill-Switch désactivé — active-le d'abord", false); }
      else {
        setLastRun({ killed: json.killed, checked: json.checked, killedList: json.killedList });
        if (json.killed > 0) {
          const msg = `${json.killed} campagne(s) stoppée(s) : ${json.killedList?.join(", ")}`;
          showToast(msg, true);
          sendNotification("AdVault — Kill-Switch 🛑", msg, "onKillSwitch");
        } else {
          showToast(`${json.checked} vérifiées — aucune sous le seuil`, true);
          sendNotification("AdVault — Kill-Switch ✓", `${json.checked} campagnes vérifiées — tout est OK`, "onKillSwitch");
        }
      }
    } catch { showToast("Erreur réseau", false); }
    setRunning(false);
  }

  const inputBase: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 14, outline: "none",
    background: "#1A1A1C", border: "1.5px solid rgba(255,255,255,0.06)",
    color: "#E4E4E7", transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: "#111113", borderRadius: 20, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        {/* Toggle row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: cfg.killSwitchEnabled ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.04)",
              border: cfg.killSwitchEnabled ? "1px solid rgba(0,255,135,0.15)" : "1px solid rgba(255,255,255,0.06)",
              transition: "all 0.3s",
            }}>
              <Zap size={16} strokeWidth={1.5} style={{
                color: cfg.killSwitchEnabled ? "#00FF87" : "#3F3F46",
                filter: cfg.killSwitchEnabled ? "drop-shadow(0 0 5px rgba(0,255,135,0.6))" : "none",
                transition: "all 0.3s",
              }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#F5F5F7", margin: 0 }}>Kill-Switch</p>
              <p style={{ fontSize: 12, color: cfg.killSwitchEnabled ? "#00FF87" : "#3F3F46", marginTop: 2, transition: "color 0.3s" }}>
                {cfg.killSwitchEnabled ? `Actif — seuil ROI ${cfg.roiThreshold}%` : "Désactivé"}
              </p>
            </div>
          </div>

          {/* iOS-style toggle */}
          <button
            onClick={() => setCfg(p => ({ ...p, killSwitchEnabled: !p.killSwitchEnabled }))}
            style={{
              position: "relative", width: 51, height: 31, borderRadius: 99, border: "none",
              background: cfg.killSwitchEnabled ? "#00FF87" : "#27272A",
              cursor: "pointer", transition: "background 0.25s", flexShrink: 0,
              boxShadow: cfg.killSwitchEnabled ? "0 0 12px rgba(0,255,135,0.4)" : "inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <motion.div
              animate={{ left: cfg.killSwitchEnabled ? 22 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              style={{
                position: "absolute", top: 2, width: 27, height: 27, borderRadius: "50%",
                background: "#FFFFFF",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
            />
          </button>
        </div>

        {/* Settings */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ROI threshold */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Seuil ROI minimum</label>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color: "#FF453A", fontVariantNumeric: "tabular-nums" }}>
                {cfg.roiThreshold}%
              </span>
            </div>
            <div style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99,
                background: "linear-gradient(90deg, rgba(255,69,58,0.4), #FF453A)",
                boxShadow: "0 0 8px rgba(255,69,58,0.3)",
                width: `${((cfg.roiThreshold - (-100)) / (-5 - (-100))) * 100}%`,
                transition: "width 0.1s",
              }} />
              <input type="range" min={-100} max={-5} step={5} value={cfg.roiThreshold}
                onChange={e => setCfg(p => ({ ...p, roiThreshold: Number(e.target.value) }))}
                style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, height: "100%", cursor: "pointer" }}
              />
            </div>
            <p style={{ fontSize: 11, color: "#27272A", marginTop: 6 }}>
              Campagnes sous {cfg.roiThreshold}% ROI stoppées automatiquement.
            </p>
          </div>

          {/* Max spend */}
          <div>
            <label style={{ fontSize: 12, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, display: "block", marginBottom: 7 }}>
              Dépense max / campagne ($) <span style={{ color: "#27272A", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>optionnel</span>
            </label>
            <input
              type="number" min={0} step={1} placeholder="Ex : 100  (vide = désactivé)"
              value={cfg.maxSpendPerCampaign ?? ""}
              onChange={e => setCfg(p => ({ ...p, maxSpendPerCampaign: e.target.value ? Number(e.target.value) : null }))}
              style={inputBase}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)"; e.currentTarget.style.background = "#111113"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.06)"; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "#1A1A1C"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          {/* Interval */}
          <div>
            <label style={{ fontSize: 12, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, display: "block", marginBottom: 7 }}>
              Fréquence de vérification
            </label>
            <select value={cfg.checkIntervalMinutes}
              onChange={e => setCfg(p => ({ ...p, checkIntervalMinutes: Number(e.target.value) }))}
              style={{ ...inputBase, appearance: "none" as const }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)"; e.currentTarget.style.background = "#111113"; }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "#1A1A1C"; }}
            >
              <option value={15}>Toutes les 15 min</option>
              <option value={30}>Toutes les 30 min</option>
              <option value={60}>Toutes les heures</option>
              <option value={120}>Toutes les 2 heures</option>
            </select>
          </div>

          {/* Last run result */}
          <AnimatePresence>
            {lastRun && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{
                  padding: "11px 14px", borderRadius: 12, fontSize: 13,
                  background: lastRun.killed > 0 ? "rgba(255,69,58,0.07)" : "rgba(0,255,135,0.07)",
                  color: lastRun.killed > 0 ? "#FF453A" : "#00FF87",
                  border: `1px solid ${lastRun.killed > 0 ? "rgba(255,69,58,0.12)" : "rgba(0,255,135,0.12)"}`,
                }}
              >
                {lastRun.killed > 0
                  ? `${lastRun.killed}/${lastRun.checked} campagne(s) stoppée(s) : ${lastRun.killedList?.join(", ")}`
                  : `✓ ${lastRun.checked} campagnes vérifiées — tout est OK`}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              whileHover={!saving ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" } : {}}
              whileTap={!saving ? { scale: 0.97 } : {}}
              onClick={save} disabled={saving}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "13px", borderRadius: 14,
                border: "1px solid rgba(0,255,135,0.25)",
                background: "rgba(0,255,135,0.1)", color: "#00FF87",
                fontSize: 13, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}
            >
              {saving
                ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><RefreshCw size={12} strokeWidth={2} /></motion.div> Sauvegarde…</>
                : <><Shield size={12} strokeWidth={2} /> Sauvegarder</>}
            </motion.button>
            <motion.button
              whileHover={!running ? { y: -1 } : {}} whileTap={!running ? { scale: 0.97 } : {}}
              onClick={runNow} disabled={running}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "13px", borderRadius: 14,
                border: "1px solid rgba(255,69,58,0.15)",
                background: "rgba(255,69,58,0.07)", color: "#FF453A",
                fontSize: 13, fontWeight: 600,
                cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1,
              }}
            >
              {running
                ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><RefreshCw size={12} strokeWidth={2} /></motion.div> Vérification…</>
                : <><Play size={12} strokeWidth={2} /> Lancer</>}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              marginTop: 10, padding: "11px 16px", borderRadius: 14, fontSize: 13, fontWeight: 500,
              background: toast.ok ? "rgba(0,255,135,0.08)" : "rgba(255,69,58,0.08)",
              color:      toast.ok ? "#00FF87" : "#FF453A",
              border: `1px solid ${toast.ok ? "rgba(0,255,135,0.15)" : "rgba(255,69,58,0.15)"}`,
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
