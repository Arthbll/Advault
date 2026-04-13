"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

interface Props {
  email:          string;
  displayName:    string;
  bio?:           string;
  createdAt:      string;
  networksCount:  number;
  campaignsCount: number;
  role?:          string;
}

type ActiveTab = "profile" | "email" | "security" | "sessions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string, email: string) {
  if (name.trim()) return name.trim().slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const C = (op: number) => `rgba(255,255,255,${op})`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ value, label, tone = "violet" }: { value: string; label: string; tone?: "violet" | "amber" | "emerald" }) {
  const tones = {
    violet:  { border: "rgba(139,92,246,0.12)",  bg: "linear-gradient(135deg,rgba(139,92,246,0.10),rgba(99,102,241,0.05))"  },
    amber:   { border: "rgba(245,158,11,0.12)",   bg: "linear-gradient(135deg,rgba(245,158,11,0.10),rgba(249,115,22,0.05))"  },
    emerald: { border: "rgba(52,211,153,0.12)",   bg: "linear-gradient(135deg,rgba(16,185,129,0.10),rgba(6,182,212,0.05))"  },
  };
  const t = tones[tone];
  return (
    <div style={{
      borderRadius: 20, border: `1px solid ${t.border}`,
      background: t.bg, padding: "18px 16px",
    }}>
      <div style={{ fontSize: 34, fontWeight: 300, letterSpacing: "-0.05em", color: "#fff", lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.34), fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function SettingRow({ label, value, action, onAction }: { label: string; value: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      borderRadius: 18, border: `1px solid ${C(0.08)}`,
      background: C(0.02), padding: "14px 16px",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.28), fontWeight: 600 }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: 15, color: C(0.88) }}>{value}</div>
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            height: 36, borderRadius: 10,
            border: `1px solid ${C(0.10)}`, background: C(0.03),
            padding: "0 14px", fontSize: 12, color: C(0.72),
            cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            flexShrink: 0, transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = C(0.06))}
          onMouseLeave={e => (e.currentTarget.style.background = C(0.03))}
        >
          {action}
        </button>
      )}
    </div>
  );
}

function FeedbackBanner({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      style={{
        padding: "10px 14px", borderRadius: 12, fontSize: 12, lineHeight: 1.5,
        background: type === "success" ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
        color: type === "success" ? "#4ade80" : "#f87171",
        border: `1px solid ${type === "success" ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)"}`,
      }}
    >
      {msg}
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfileClient({
  email, displayName: initDisplayName, bio: initBio = "",
  createdAt, networksCount, campaignsCount, role = "Admin",
}: Props) {

  const router = useRouter();

  const [tab,          setTab]          = useState<ActiveTab>("profile");
  const [displayName,  setDisplayName]  = useState(initDisplayName);
  const [bio,          setBio]          = useState(initBio);
  const [newEmail,     setNewEmail]     = useState("");
  const [newPwd,       setNewPwd]       = useState("");
  const [confirmPwd,   setConfirmPwd]   = useState("");
  const [feedback,     setFeedback]     = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPending,    startTransition] = useTransition();

  // 2FA status — checked client-side via Supabase MFA API
  const [twoFA, setTwoFA] = useState<"on" | "off" | "loading">("loading");

  // Current session info
  const [sessionInfo, setSessionInfo] = useState<{ browser: string; lastSeen: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Check 2FA
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (data) {
        const verified = data.totp?.some(f => f.status === "verified") ?? false;
        setTwoFA(verified ? "on" : "off");
      } else {
        setTwoFA("off");
      }
    }).catch(() => setTwoFA("off"));

    // Current session browser info
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const ua = navigator.userAgent;
        const browser =
          ua.includes("Edg")     ? "Edge" :
          ua.includes("Chrome")  ? "Chrome" :
          ua.includes("Firefox") ? "Firefox" :
          ua.includes("Safari")  ? "Safari" : "Browser";
        const os =
          ua.includes("iPhone")  ? "iPhone" :
          ua.includes("Android") ? "Android" :
          ua.includes("Mac")     ? "macOS" :
          ua.includes("Win")     ? "Windows" : "Unknown";
        setSessionInfo({ browser: `${browser} · ${os}`, lastSeen: "Active now" });
      }
    }).catch(() => {});
  }, []);

  const displayInitials = getInitials(displayName, email);

  function switchTab(t: ActiveTab) { setTab(t); setFeedback(null); }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleDisplayName(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!displayName.trim()) { setFeedback({ type: "error", msg: "Name cannot be empty." }); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName.trim(), bio: bio.trim() } });
      if (error) {
        setFeedback({ type: "error", msg: error.message });
      } else {
        setFeedback({ type: "success", msg: "Profile updated successfully." });
        // Pass the new name directly in the event so the top nav updates
        // without waiting for a server re-fetch (which can read a stale JWT)
        window.dispatchEvent(new CustomEvent("profitdash:profile-updated", {
          detail: { displayName: displayName.trim() },
        }));
      }
    });
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!newEmail.trim())   { setFeedback({ type: "error", msg: "Please enter an email address." }); return; }
    if (newEmail === email) { setFeedback({ type: "error", msg: "This is already your current email." }); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) setFeedback({ type: "error", msg: error.message });
      else { setFeedback({ type: "success", msg: `Confirmation link sent to ${newEmail}` }); setNewEmail(""); }
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
      if (error) setFeedback({ type: "error", msg: error.message });
      else { setFeedback({ type: "success", msg: "Password updated." }); setNewPwd(""); setConfirmPwd(""); }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "profile",  label: "Profile"  },
    { id: "email",    label: "Email"    },
    { id: "security", label: "Security" },
    { id: "sessions", label: "Sessions" },
  ];

  return (
    <div style={{ padding: "20px 28px 60px" }}>

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        style={{
          borderRadius: 34,
          border: `1px solid ${C(0.08)}`,
          background: [
            "radial-gradient(circle at 15% 0%, rgba(99,102,241,0.14), transparent 26%)",
            "radial-gradient(circle at 80% 0%, rgba(45,212,191,0.06), transparent 20%)",
            "linear-gradient(180deg, #0b0d14, #07080d)",
          ].join(", "),
          boxShadow: "0 40px 120px rgba(0,0,0,0.45)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
        }}
      >

        {/* ── Left panel ── */}
        <div style={{
          borderRight: `1px solid ${C(0.06)}`,
          padding: 28,
          display: "flex", flexDirection: "column", gap: 20,
        }}>

          {/* Identity card */}
          <div style={{ borderRadius: 26, border: `1px solid ${C(0.08)}`, background: C(0.02), padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 500, color: "rgba(221,214,254,1)",
                background: "rgba(139,92,246,0.12)",
                border: "1px solid rgba(167,139,250,0.2)",
              }}>
                {displayInitials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 300, letterSpacing: "-0.05em", color: "#fff" }}>
                  {displayName.trim() || email.split("@")[0]}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: C(0.46) }}>{email}</div>
                <div style={{
                  marginTop: 8, display: "inline-flex",
                  borderRadius: 99, border: "1px solid rgba(52,211,153,0.16)",
                  background: "rgba(16,185,129,0.08)",
                  padding: "4px 12px",
                  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em",
                  color: "rgba(167,243,208,1)", fontWeight: 600,
                }}>
                  {role} · Command
                </div>
              </div>
            </div>

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 24 }}>
              <StatCard value={networksCount  > 0 ? String(networksCount)  : "—"} label="Connected networks" tone="amber"   />
              <StatCard value={campaignsCount > 0 ? String(campaignsCount) : "—"} label="Campaigns tracked"  tone="violet"  />
              <StatCard value={twoFA === "loading" ? "…" : twoFA === "on" ? "On" : "Off"} label="2FA status" tone={twoFA === "on" ? "emerald" : "violet"} />
              <StatCard value={fmtDate(createdAt).split(" ").pop() ?? "—"} label="Member since" tone="violet" />
            </div>
          </div>

          {/* Quick links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SettingRow label="Workspace" value="ProfitDash" action="Open settings" onAction={() => router.push("/dashboard/settings")} />
            <SettingRow label="Authentication" value="Supabase Auth · Protected" action="Security" onAction={() => switchTab("security")} />
            <form action={logout}>
              <button
                type="submit"
                style={{
                  width: "100%", height: 48, borderRadius: 18,
                  border: "1px solid rgba(248,113,113,0.14)",
                  background: "rgba(239,68,68,0.06)",
                  color: "rgba(254,202,202,1)",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.10)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 28 }}>

          {/* Header + tabs */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.26), fontWeight: 600 }}>Account</div>
              <div style={{ marginTop: 8, fontSize: 32, fontWeight: 300, letterSpacing: "-0.05em", color: "#fff" }}>Personal settings</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => switchTab(id)}
                  style={{
                    height: 44, borderRadius: 12, padding: "0 16px",
                    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                    border: tab === id ? "1px solid rgba(167,139,250,0.2)" : `1px solid ${C(0.08)}`,
                    background: tab === id ? "rgba(139,92,246,0.12)" : C(0.02),
                    color: tab === id ? "rgba(221,214,254,1)" : C(0.5),
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (tab !== id) e.currentTarget.style.color = C(0.8); }}
                  onMouseLeave={e => { if (tab !== id) e.currentTarget.style.color = C(0.5); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait">

            {/* Profile tab */}
            {tab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
              >
                {/* Left col: editable fields */}
                <form onSubmit={handleDisplayName} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ borderRadius: 24, border: `1px solid ${C(0.08)}`, background: C(0.02), padding: 20 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.28), fontWeight: 600 }}>Display name</div>
                    <input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      style={{
                        marginTop: 12, width: "100%", height: 48, borderRadius: 12,
                        border: `1px solid ${C(0.08)}`, background: "rgba(0,0,0,0.2)",
                        padding: "0 14px", fontSize: 14, color: C(0.80),
                        outline: "none", fontFamily: "inherit", colorScheme: "dark",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = C(0.18))}
                      onBlur={e  => (e.currentTarget.style.borderColor = C(0.08))}
                    />
                  </div>
                  <div style={{ borderRadius: 24, border: `1px solid ${C(0.08)}`, background: C(0.02), padding: 20 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.28), fontWeight: 600 }}>Bio / title</div>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Media buyer, affiliate marketer…"
                      rows={3}
                      style={{
                        marginTop: 12, width: "100%", borderRadius: 12,
                        border: `1px solid ${C(0.08)}`, background: "rgba(0,0,0,0.2)",
                        padding: "12px 14px", fontSize: 14, color: C(0.80),
                        outline: "none", fontFamily: "inherit", resize: "none",
                        colorScheme: "dark", lineHeight: 1.5,
                        transition: "border-color 0.15s",
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = C(0.18))}
                      onBlur={e  => (e.currentTarget.style.borderColor = C(0.08))}
                    />
                  </div>

                  <AnimatePresence>
                    {feedback && tab === "profile" && <FeedbackBanner type={feedback.type} msg={feedback.msg} />}
                  </AnimatePresence>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="submit" disabled={isPending}
                      style={{
                        height: 48, borderRadius: 16, padding: "0 24px",
                        background: "linear-gradient(90deg,#8b5cf6,#6366f1)",
                        border: "none", fontSize: 13, fontWeight: 500, color: "#fff",
                        cursor: isPending ? "not-allowed" : "pointer",
                        opacity: isPending ? 0.6 : 1,
                        fontFamily: "inherit",
                        boxShadow: "0 6px 20px rgba(99,102,241,0.3)",
                      }}
                    >
                      {isPending ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDisplayName(initDisplayName); setFeedback(null); }}
                      style={{
                        height: 48, borderRadius: 16, padding: "0 20px",
                        border: `1px solid ${C(0.10)}`, background: C(0.03),
                        fontSize: 13, color: C(0.70), cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>

                {/* Right col: read-only overview */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <SettingRow label="Current email" value={email} action="Change" onAction={() => switchTab("email")} />
                  <SettingRow label="Password" value="••••••••••••" action="Update" onAction={() => switchTab("security")} />
                  <SettingRow label="Two-factor authentication" value="Managed via Supabase" action="Manage" onAction={() => switchTab("security")} />
                  <SettingRow label="Active sessions" value="Current session active" action="Review" onAction={() => switchTab("sessions")} />

                  {/* Security summary */}
                  <div style={{
                    borderRadius: 24,
                    border: "1px solid rgba(139,92,246,0.14)",
                    background: "rgba(139,92,246,0.06)",
                    padding: 20,
                  }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(221,214,254,0.8)", fontWeight: 600 }}>Security summary</div>
                    <div style={{ marginTop: 12, fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: "#fff" }}>Protected account</div>
                    <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: C(0.58) }}>
                      Your account is secured with Supabase Auth. Update your password or manage sessions from the Security and Sessions tabs.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Email tab */}
            {tab === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ maxWidth: 480 }}
              >
                <SettingRow label="Current email" value={email} />
                <form onSubmit={handleEmailChange} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ borderRadius: 24, border: `1px solid ${C(0.08)}`, background: C(0.02), padding: 20 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.28), fontWeight: 600 }}>New email</div>
                    <input
                      type="email" value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="name@domain.com"
                      style={{
                        marginTop: 12, width: "100%", height: 48, borderRadius: 12,
                        border: `1px solid ${C(0.08)}`, background: "rgba(0,0,0,0.2)",
                        padding: "0 14px", fontSize: 14, color: C(0.80),
                        outline: "none", fontFamily: "inherit", colorScheme: "dark",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = C(0.18))}
                      onBlur={e  => (e.currentTarget.style.borderColor = C(0.08))}
                    />
                  </div>

                  <SettingRow label="Verification" value="A confirmation link will be sent to the new address" />

                  <AnimatePresence>
                    {feedback && tab === "email" && <FeedbackBanner type={feedback.type} msg={feedback.msg} />}
                  </AnimatePresence>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="submit" disabled={isPending}
                      style={{
                        height: 44, borderRadius: 14, padding: "0 22px",
                        background: "linear-gradient(90deg,#8b5cf6,#6366f1)",
                        border: "none", fontSize: 13, fontWeight: 500, color: "#fff",
                        cursor: isPending ? "not-allowed" : "pointer",
                        opacity: isPending ? 0.6 : 1, fontFamily: "inherit",
                      }}
                    >
                      {isPending ? "Sending…" : "Send verification"}
                    </button>
                    <button
                      type="button" onClick={() => { setNewEmail(""); setFeedback(null); }}
                      style={{
                        height: 44, borderRadius: 14, padding: "0 18px",
                        border: `1px solid ${C(0.10)}`, background: C(0.03),
                        fontSize: 13, color: C(0.70), cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Security tab */}
            {tab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}
              >
                <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ borderRadius: 24, border: `1px solid ${C(0.08)}`, background: C(0.02), padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "New password",     value: newPwd,     set: setNewPwd,     placeholder: "8 characters minimum" },
                      { label: "Confirm password", value: confirmPwd, set: setConfirmPwd, placeholder: "Repeat password"       },
                    ].map(({ label, value, set, placeholder }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", color: C(0.28), fontWeight: 600 }}>{label}</div>
                        <input
                          type="password" value={value}
                          onChange={e => set(e.target.value)}
                          placeholder={placeholder}
                          autoComplete="new-password"
                          style={{
                            marginTop: 8, width: "100%", height: 48, borderRadius: 12,
                            border: `1px solid ${C(0.08)}`, background: "rgba(0,0,0,0.2)",
                            padding: "0 14px", fontSize: 14, color: C(0.80),
                            outline: "none", fontFamily: "inherit", colorScheme: "dark",
                            transition: "border-color 0.15s",
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = C(0.18))}
                          onBlur={e  => (e.currentTarget.style.borderColor = C(0.08))}
                        />
                      </div>
                    ))}
                  </div>

                  <AnimatePresence>
                    {feedback && tab === "security" && <FeedbackBanner type={feedback.type} msg={feedback.msg} />}
                  </AnimatePresence>

                  <button
                    type="submit" disabled={isPending}
                    style={{
                      height: 44, borderRadius: 14, padding: "0 22px", alignSelf: "flex-start",
                      background: "linear-gradient(90deg,#8b5cf6,#6366f1)",
                      border: "none", fontSize: 13, fontWeight: 500, color: "#fff",
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.6 : 1, fontFamily: "inherit",
                    }}
                  >
                    {isPending ? "Updating…" : "Update password"}
                  </button>
                </form>

                {/* 2FA info */}
                <SettingRow
                  label="Two-factor authentication"
                  value={twoFA === "loading" ? "Checking…" : twoFA === "on" ? "Enabled · active" : "Not enabled"}
                />
                <div style={{
                  borderRadius: 20,
                  border: `1px solid ${twoFA === "on" ? "rgba(52,211,153,0.14)" : "rgba(251,191,36,0.12)"}`,
                  background: twoFA === "on" ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.05)",
                  padding: 16, fontSize: 13,
                  color: twoFA === "on" ? "rgba(167,243,208,1)" : "rgba(253,230,138,0.8)",
                  lineHeight: 1.6,
                }}>
                  {twoFA === "on"
                    ? "✓ Two-factor authentication is active. Your account has an extra layer of security."
                    : twoFA === "loading"
                    ? "Checking 2FA status…"
                    : "⚠ 2FA is not enabled. We recommend activating it via your authenticator app through Supabase Auth settings."}
                </div>
              </motion.div>
            )}

            {/* Sessions tab */}
            {tab === "sessions" && (
              <motion.div
                key="sessions"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <SettingRow
                  label="Current session"
                  value={sessionInfo ? `${sessionInfo.browser} · ${sessionInfo.lastSeen}` : "Active now · this device"}
                />
                <SettingRow label="Account email" value={email} />
                <SettingRow label="Member since"  value={fmtDate(createdAt)} />

                {/* 2FA status recap */}
                <div style={{
                  borderRadius: 20,
                  border: `1px solid ${twoFA === "on" ? "rgba(52,211,153,0.14)" : "rgba(251,191,36,0.12)"}`,
                  background: twoFA === "on" ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.05)",
                  padding: 16, fontSize: 13,
                  color: twoFA === "on" ? "rgba(167,243,208,1)" : "rgba(253,230,138,0.8)",
                  lineHeight: 1.6,
                }}>
                  {twoFA === "on"
                    ? "✓ Two-factor authentication is active on this account."
                    : twoFA === "loading"
                    ? "Checking 2FA status…"
                    : "⚠ Two-factor authentication is not enabled. We recommend activating it in the Security tab."}
                </div>

                <form action={logout}>
                  <button
                    type="submit"
                    style={{
                      height: 44, borderRadius: 14, padding: "0 20px",
                      border: "1px solid rgba(248,113,113,0.14)",
                      background: "rgba(239,68,68,0.06)",
                      color: "rgba(254,202,202,1)",
                      fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.10)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                  >
                    Sign out all sessions
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
