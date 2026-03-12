"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, LogOut, Shield, BarChart2, Network, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email:          string;
  createdAt:      string;
  networksCount:  number;
  campaignsCount: number;
}

function initials(email: string) { return email.slice(0, 2).toUpperCase(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const inputBase: React.CSSProperties = {
  width: "100%", padding: "13px 16px 13px 40px",
  borderRadius: 12, fontSize: 14, outline: "none",
  background: "#1A1A1C", border: "1.5px solid rgba(255,255,255,0.06)",
  color: "#E4E4E7", transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
  boxSizing: "border-box",
};

export default function ProfileClient({ email, createdAt, networksCount, campaignsCount }: Props) {
  const [tab,       setTab]       = useState<"info" | "password">("info");
  const [feedback,  setFeedback]  = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (newPwd !== confirmPwd) { setFeedback({ type: "error", msg: "Les mots de passe ne correspondent pas." }); return; }
    if (newPwd.length < 8)     { setFeedback({ type: "error", msg: "Minimum 8 caractères." }); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) setFeedback({ type: "error",   msg: error.message });
      else { setFeedback({ type: "success", msg: "Mot de passe mis à jour." }); setNewPwd(""); setConfirmPwd(""); }
    });
  }

  return (
    <div style={{ background: "#0A0A0B", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}
        >
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            style={{ position: "relative", flexShrink: 0 }}
          >
            <div style={{
              width: 68, height: 68, borderRadius: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
              background: "#FFD60A",
              color: "#000000",
              boxShadow: "0 0 0 1px rgba(255,214,10,0.3), 0 4px 20px rgba(255,214,10,0.35)",
            }}>
              {initials(email)}
            </div>
            {/* Pulsing ring */}
            <motion.div
              style={{ position: "absolute", inset: -5, borderRadius: 27, border: "1.5px solid rgba(255,214,10,0.25)" }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          <div>
            <p style={{ fontSize: 12, color: "#3F3F46", marginBottom: 4 }}>Profil</p>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", margin: 0, lineHeight: 1 }}>
              Mon profil
            </h1>
            <p style={{ fontSize: 14, color: "#52525B", marginTop: 7 }}>{email}</p>
            <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 3 }}>Membre depuis {fmtDate(createdAt)}</p>
          </div>
        </motion.div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, alignItems: "start" }}>

          {/* Left — stats + security badge */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Stats */}
            {[
              { icon: Network,   label: "Réseaux connectés", value: networksCount,  color: "#FFD60A", rgb: "255,214,10" },
              { icon: BarChart2, label: "Campagnes suivies",  value: campaignsCount, color: "#8B5CF6", rgb: "139,92,246" },
            ].map(({ icon: Icon, label, value, color, rgb }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                style={{
                  background: "#111113", borderRadius: 20, padding: "20px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
                  overflow: "hidden", position: "relative",
                  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.18s",
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `rgba(${rgb},0.2)`;
                  el.style.boxShadow = `0 0 0 1px rgba(${rgb},0.08), 0 8px 32px rgba(0,0,0,0.5), 0 0 40px rgba(${rgb},0.07)`;
                  el.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(255,255,255,0.06)";
                  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)";
                  el.style.transform = "translateY(0)";
                }}
              >
                {/* Top accent bar */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, rgba(${rgb},0.6), transparent)` }} />

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `rgba(${rgb},0.08)`,
                    border: `1px solid rgba(${rgb},0.12)`,
                  }}>
                    <Icon size={17} strokeWidth={1.5} style={{ color, filter: `drop-shadow(0 0 4px rgba(${rgb},0.4))` }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: "#F5F5F7", lineHeight: 1, margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
                    <p style={{ fontSize: 12, color: "#3F3F46", marginTop: 4 }}>{label}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Security badge */}
            <div style={{
              background: "#111113", borderRadius: 20, padding: "16px 20px",
              border: "1px solid rgba(0,255,135,0.08)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.12)",
              }}>
                <Shield size={15} strokeWidth={1.5} style={{ color: "#00FF87", filter: "drop-shadow(0 0 4px rgba(0,255,135,0.4))" }} />
              </div>
              <p style={{ fontSize: 13, color: "#00FF87", margin: 0, fontWeight: 500 }}>Compte sécurisé · Supabase Auth</p>
            </div>
          </div>

          {/* Right — tabs + form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            style={{
              background: "#111113", borderRadius: 20, overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {([["info", Mail, "Informations"], ["password", Lock, "Mot de passe"]] as const).map(([id, Icon, label]) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setFeedback(null); }}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "16px", border: "none",
                    background: "transparent",
                    borderBottom: tab === id ? "2px solid #00FF87" : "2px solid transparent",
                    color:  tab === id ? "#F5F5F7" : "#3F3F46",
                    fontSize: 14, fontWeight: tab === id ? 600 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    marginBottom: -1,
                  }}
                >
                  <Icon
                    size={13}
                    strokeWidth={1.5}
                    style={{
                      color: tab === id ? "#00FF87" : "#3F3F46",
                      filter: tab === id ? "drop-shadow(0 0 3px rgba(0,255,135,0.5))" : "none",
                      transition: "color 0.15s, filter 0.15s",
                    }}
                  />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {tab === "info" && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Email row */}
                  <div style={{
                    background: "#1A1A1C", borderRadius: 14, padding: "16px 18px",
                    display: "flex", alignItems: "center", gap: 12,
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <Mail size={13} strokeWidth={1.5} style={{ color: "#52525B" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#3F3F46", margin: 0 }}>Email</p>
                      <p style={{ fontSize: 14, color: "#E4E4E7", marginTop: 3 }}>{email}</p>
                    </div>
                  </div>

                  {/* Logout */}
                  <form action={logout}>
                    <motion.button
                      type="submit"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "13px", borderRadius: 14, border: "1px solid rgba(255,69,58,0.15)",
                        background: "rgba(255,69,58,0.07)", color: "#FF453A",
                        fontSize: 14, fontWeight: 600, cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      <LogOut size={14} strokeWidth={1.5} />
                      Se déconnecter
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {tab === "password" && (
                <motion.div
                  key="password"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  style={{ padding: "24px" }}
                >
                  <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                      { label: "Nouveau mot de passe",      value: newPwd,     set: setNewPwd,     placeholder: "Min. 8 caractères" },
                      { label: "Confirmer le mot de passe", value: confirmPwd, set: setConfirmPwd, placeholder: "Répète le mot de passe" },
                    ].map(({ label, value, set, placeholder }) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <label style={{ fontSize: 12, color: "#3F3F46", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</label>
                        <div style={{ position: "relative" }}>
                          <Lock size={12} strokeWidth={1.5} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#3F3F46", pointerEvents: "none" }} />
                          <input
                            type="password"
                            value={value}
                            onChange={e => set(e.target.value)}
                            placeholder={placeholder}
                            required
                            style={inputBase}
                            onFocus={e => {
                              e.currentTarget.style.borderColor = "rgba(0,255,135,0.4)";
                              e.currentTarget.style.background = "#111113";
                              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,255,135,0.06)";
                            }}
                            onBlur={e => {
                              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                              e.currentTarget.style.background = "#1A1A1C";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    <AnimatePresence>
                      {feedback && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "11px 14px", borderRadius: 12, fontSize: 13,
                            background: feedback.type === "success" ? "rgba(0,255,135,0.07)"  : "rgba(255,69,58,0.07)",
                            color:      feedback.type === "success" ? "#00FF87" : "#FF453A",
                            border: `1px solid ${feedback.type === "success" ? "rgba(0,255,135,0.12)" : "rgba(255,69,58,0.12)"}`,
                          }}
                        >
                          {feedback.type === "success"
                            ? <CheckCircle size={12} strokeWidth={1.5} />
                            : <AlertCircle size={12} strokeWidth={1.5} />}
                          {feedback.msg}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="submit" disabled={isPending}
                      whileHover={!isPending ? { y: -1, boxShadow: "0 0 0 1px rgba(0,255,135,0.25), 0 4px 20px rgba(0,255,135,0.2)" } : {}}
                      whileTap={!isPending ? { scale: 0.97 } : {}}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "13px", borderRadius: 14,
                        border: "1px solid rgba(0,255,135,0.25)",
                        background: "rgba(0,255,135,0.1)", color: "#00FF87",
                        fontSize: 14, fontWeight: 600,
                        cursor: isPending ? "not-allowed" : "pointer",
                        opacity: isPending ? 0.6 : 1,
                        transition: "box-shadow 0.15s, border-color 0.15s",
                      }}
                    >
                      {isPending
                        ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}><Loader size={14} strokeWidth={1.5} /></motion.div>
                        : "Mettre à jour"
                      }
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
