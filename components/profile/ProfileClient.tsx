"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, LogOut, Shield, BarChart2, Network,
  CheckCircle, AlertCircle, Loader, User, AtSign,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email:          string;
  displayName:    string;
  createdAt:      string;
  networksCount:  number;
  campaignsCount: number;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "#17171e",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 18,
  overflow: "hidden",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.4)",
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: "#3f3f46",
};

const INPUT: React.CSSProperties = {
  width: "100%", padding: "11px 14px 11px 38px",
  borderRadius: 10, fontSize: 13, outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  color: "rgba(255,255,255,0.85)",
  transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box",
  colorScheme: "dark",
};

const TABS = [
  { id: "info"     as const, Icon: User,  label: "Profile"  },
  { id: "email"    as const, Icon: AtSign, label: "Email"   },
  { id: "password" as const, Icon: Lock,  label: "Security" },
] as const;

type Tab = typeof TABS[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string, email: string) {
  if (name.trim()) return name.trim().slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function s(i: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: i * 0.07 },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeedbackBanner({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 13px", borderRadius: 10, fontSize: 12,
        background: type === "success" ? "rgba(74,222,128,0.07)"  : "rgba(248,113,113,0.07)",
        color:      type === "success" ? "#4ade80" : "#f87171",
        border: `1px solid ${type === "success" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)"}`,
      }}
    >
      {type === "success"
        ? <CheckCircle size={11} strokeWidth={1.5} />
        : <AlertCircle size={11} strokeWidth={1.5} />
      }
      {msg}
    </motion.div>
  );
}

function InputWithIcon({ icon: Icon, value, onChange, placeholder, type = "text", autoComplete }: {
  icon: React.ElementType; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; autoComplete?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <Icon size={11} strokeWidth={1.5} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#52525b", pointerEvents: "none" }} />
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        style={INPUT}
        onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      />
    </div>
  );
}

function SubmitBtn({ isPending, label, pendingLabel }: { isPending: boolean; label: string; pendingLabel: string }) {
  return (
    <motion.button
      type="submit" disabled={isPending}
      whileHover={!isPending ? { background: "rgba(139,92,246,0.18)", borderColor: "rgba(139,92,246,0.4)" } : {}}
      whileTap={!isPending ? { scale: 0.98 } : {}}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "12px", borderRadius: 12,
        border: "1px solid rgba(139,92,246,0.22)",
        background: "rgba(139,92,246,0.1)", color: "#a78bfa",
        fontSize: 13, fontWeight: 500,
        cursor: isPending ? "not-allowed" : "pointer",
        opacity: isPending ? 0.6 : 1,
        transition: "all 0.15s",
      }}
    >
      {isPending
        ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
            <Loader size={13} strokeWidth={1.5} />
          </motion.div>
        : label
      }
      {isPending && <span style={{ fontSize: 12 }}>{pendingLabel}</span>}
    </motion.button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfileClient({ email, displayName: initDisplayName, createdAt, networksCount, campaignsCount }: Props) {
  const [tab,        setTab]        = useState<Tab>("info");
  const [feedback,   setFeedback]   = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPending,  startTransition] = useTransition();

  // Profile tab
  const [displayName, setDisplayName] = useState(initDisplayName);

  // Email tab
  const [newEmail,     setNewEmail]     = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");

  // Password tab
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  function switchTab(t: Tab) { setTab(t); setFeedback(null); }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleDisplayName(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!displayName.trim()) { setFeedback({ type: "error", msg: "Name cannot be empty." }); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
      if (error) setFeedback({ type: "error",   msg: error.message });
      else       setFeedback({ type: "success", msg: "Name updated successfully." });
    });
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!newEmail.trim())        { setFeedback({ type: "error", msg: "Please enter an email address." }); return; }
    if (newEmail !== emailConfirm) { setFeedback({ type: "error", msg: "Emails do not match." }); return; }
    if (newEmail === email)        { setFeedback({ type: "error", msg: "This is already your current email." }); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) setFeedback({ type: "error", msg: error.message });
      else {
        setFeedback({ type: "success", msg: "A confirmation link has been sent to " + newEmail });
        setNewEmail(""); setEmailConfirm("");
      }
    });
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (newPwd !== confirmPwd) { setFeedback({ type: "error", msg: "Passwords do not match." }); return; }
    if (newPwd.length < 8)     { setFeedback({ type: "error", msg: "Minimum 8 characters." }); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) setFeedback({ type: "error",   msg: error.message });
      else { setFeedback({ type: "success", msg: "Password updated." }); setNewPwd(""); setConfirmPwd(""); }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const displayInitials = initials(displayName, email);

  return (
    <div style={{ padding: "18px 22px 48px", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header ── */}
      <motion.div {...s(0)} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 4 }}>
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          style={{
            width: 56, height: 56, borderRadius: 17, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 300, letterSpacing: "-0.02em",
            background: "rgba(139,92,246,0.12)",
            color: "#a78bfa",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {displayInitials}
        </motion.div>

        <div>
          <p style={LABEL}>User profile</p>
          <h1 style={{ fontSize: 26, fontWeight: 300, color: "rgba(255,255,255,0.92)", margin: "4px 0 0", letterSpacing: "-0.03em" }}>
            {displayName.trim() || email.split("@")[0]}
          </h1>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
            {email} · Member since {fmtDate(createdAt)}
          </p>
        </div>
      </motion.div>

      {/* ── Two-column ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10, alignItems: "start" }}>

        {/* Left — stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { icon: Network,   label: "Connected networks", value: networksCount,  color: "#fbbf24", bg: "rgba(251,191,36,0.08)" },
            { icon: BarChart2, label: "Campaigns tracked",  value: campaignsCount, color: "#a78bfa", bg: "rgba(139,92,246,0.08)" },
          ].map(({ icon: Icon, label, value, color, bg }, i) => (
            <motion.div key={label} {...s(i + 1)} style={{ ...CARD, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: bg }}>
                  <Icon size={15} strokeWidth={1.5} style={{ color }} />
                </div>
                <div>
                  <span style={{ fontSize: 32, fontWeight: 200, letterSpacing: "-0.04em", color: value === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)", display: "block", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {value === 0 ? "—" : value}
                  </span>
                  <p style={{ ...LABEL, marginTop: 4 }}>{label}</p>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Security badge */}
          <motion.div {...s(3)} style={{ ...CARD, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(74,222,128,0.08)" }}>
              <Shield size={13} strokeWidth={1.5} style={{ color: "#4ade80" }} />
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)", margin: 0 }}>Supabase Auth</p>
              <p style={{ ...LABEL, marginTop: 2 }}>Secured account · AES-256</p>
            </div>
          </motion.div>

          {/* Logout */}
          <motion.div {...s(4)}>
            <form action={logout}>
              <motion.button
                type="submit"
                whileHover={{ background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.2)" }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px", borderRadius: 12,
                  border: "1px solid rgba(248,113,113,0.1)",
                  background: "rgba(248,113,113,0.04)", color: "#f87171",
                  fontSize: 12, fontWeight: 400, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <LogOut size={12} strokeWidth={1.5} />
                Sign out
              </motion.button>
            </form>
          </motion.div>
        </div>

        {/* Right — tabs card */}
        <motion.div {...s(2)} style={CARD}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            {TABS.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "14px", border: "none", background: "transparent",
                  borderBottom: tab === id ? "1.5px solid rgba(139,92,246,0.7)" : "1.5px solid transparent",
                  color: tab === id ? "#a78bfa" : "#3f3f46",
                  fontSize: 12, fontWeight: tab === id ? 500 : 400,
                  cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                }}
              >
                <Icon size={11} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}

            {/* ── Profile tab ── */}
            {tab === "info" && (
              <motion.div key="info"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{ padding: "20px" }}
              >
                <form onSubmit={handleDisplayName} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ ...LABEL, display: "block", marginBottom: 6 }}>Display name</label>
                    <InputWithIcon
                      icon={User} value={displayName} onChange={setDisplayName}
                      placeholder="Your first name or username" autoComplete="name"
                    />
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6, lineHeight: 1.5 }}>
                      This name is shown in the dashboard and on your profile.
                    </p>
                  </div>

                  {/* Email display (read-only) */}
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                    <Mail size={11} strokeWidth={1.5} style={{ color: "#52525b", flexShrink: 0 }} />
                    <div>
                      <p style={{ ...LABEL, marginBottom: 2 }}>Current email</p>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>{email}</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {feedback && <FeedbackBanner type={feedback.type} msg={feedback.msg} />}
                  </AnimatePresence>

                  <SubmitBtn isPending={isPending} label="Save" pendingLabel="Saving…" />
                </form>
              </motion.div>
            )}

            {/* ── Email tab ── */}
            {tab === "email" && (
              <motion.div key="email"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{ padding: "20px" }}
              >
                <form onSubmit={handleEmailChange} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)", borderRadius: 10, padding: "10px 13px", fontSize: 11, color: "rgba(251,191,36,0.7)", lineHeight: 1.5 }}>
                    A confirmation link will be sent to the new address. Your old email stays active until confirmed.
                  </div>

                  {[
                    { label: "New email",          value: newEmail,     set: setNewEmail,     placeholder: "new@email.com",      autoComplete: "email" },
                    { label: "Confirm new email",  value: emailConfirm, set: setEmailConfirm, placeholder: "Repeat new email",   autoComplete: "email" },
                  ].map(({ label, value, set, placeholder, autoComplete }) => (
                    <div key={label}>
                      <label style={{ ...LABEL, display: "block", marginBottom: 6 }}>{label}</label>
                      <InputWithIcon icon={AtSign} value={value} onChange={set} placeholder={placeholder} autoComplete={autoComplete} />
                    </div>
                  ))}

                  <AnimatePresence>
                    {feedback && <FeedbackBanner type={feedback.type} msg={feedback.msg} />}
                  </AnimatePresence>

                  <SubmitBtn isPending={isPending} label="Change email" pendingLabel="Sending…" />
                </form>
              </motion.div>
            )}

            {/* ── Password tab ── */}
            {tab === "password" && (
              <motion.div key="password"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                style={{ padding: "20px" }}
              >
                <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "New password",      value: newPwd,     set: setNewPwd,     placeholder: "8 characters minimum" },
                    { label: "Confirm password",  value: confirmPwd, set: setConfirmPwd, placeholder: "Repeat password"       },
                  ].map(({ label, value, set, placeholder }) => (
                    <div key={label}>
                      <label style={{ ...LABEL, display: "block", marginBottom: 6 }}>{label}</label>
                      <InputWithIcon icon={Lock} value={value} onChange={set} placeholder={placeholder} type="password" autoComplete="new-password" />
                    </div>
                  ))}

                  <AnimatePresence>
                    {feedback && <FeedbackBanner type={feedback.type} msg={feedback.msg} />}
                  </AnimatePresence>

                  <SubmitBtn isPending={isPending} label="Update password" pendingLabel="Updating…" />
                </form>
              </motion.div>
            )}
        </motion.div>
      </div>
    </div>
  );
}
