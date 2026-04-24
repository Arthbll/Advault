"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle, Mail } from "lucide-react";
import { login, signInWithGoogle, signInWithApple, signInWithMagicLink } from "@/app/actions/auth";

// ─── Ease ─────────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

// ─── Input style ──────────────────────────────────────────────────────────────
const INPUT: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 16px",
  borderRadius: 12,
  fontSize: 14,
  outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  color: "rgba(255,255,255,0.88)",
  transition: "border-color 0.18s, background 0.18s",
  boxSizing: "border-box",
  colorScheme: "dark",
  letterSpacing: "0.01em",
};

// ─── Logo SVG ─────────────────────────────────────────────────────────────────
function LogoIcon({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-login" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="10" fill="url(#lg-login)" />
      <polyline
        points="7,27 14,18 20,22 27,12 31,15"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.92"
      />
      <circle cx="31" cy="15" r="2" fill="white" opacity="0.92" />
    </svg>
  );
}

// ─── Apple icon ───────────────────────────────────────────────────────────────
function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

// ─── Google icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────
function LoginPageInner() {
  const [error,   setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPw,  setShowPw]  = useState(false);
  const [kickedBanner,     setKickedBanner]     = useState(false);
  const [confirmedBanner,  setConfirmedBanner]  = useState(false);

  // Magic link mode state
  const [magicMode, setMagicMode] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get("reason") === "kicked") setKickedBanner(true);
    if (searchParams?.get("confirmed") === "true")  setConfirmedBanner(true);
  }, [searchParams]);

  // ── Normal sign-in ──────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  // ── Google OAuth ────────────────────────────────────────────────────────────
  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result?.error) setError(result.error);
    });
  }

  // ── Apple OAuth ─────────────────────────────────────────────────────────────
  function handleApple() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithApple();
      if (result?.error) setError(result.error);
    });
  }

  // ── Magic link ──────────────────────────────────────────────────────────────
  function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await signInWithMagicLink(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setMagicSent(true);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      style={{ width: "100%", maxWidth: 420 }}
    >
      {/* ── Card ──────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(18,19,28,0.97) 0%, rgba(10,11,18,0.99) 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24,
          boxShadow: "0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
          padding: "32px 32px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <LogoIcon size={38} />
          <div>
            <p style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.92)", margin: 0, lineHeight: 1 }}>
              ProfitDash
            </p>
            <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.20em", color: "rgba(255,255,255,0.22)", margin: "4px 0 0" }}>
              Campaign decision engine
            </p>
          </div>
        </div>

        {/* Headline */}
        <p style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.90)", margin: "0 0 24px", lineHeight: 1.2 }}>
          Sign in to ProfitDash
        </p>

        <AnimatePresence mode="wait">

          {/* ── Magic link sent confirmation ─────────────────────────────────── */}
          {magicSent ? (
            <motion.div
              key="magic-sent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", paddingBottom: 8 }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)",
              }}>
                <Mail size={20} strokeWidth={1.5} style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 300, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.92)", margin: "0 0 8px" }}>
                  Check your inbox
                </p>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.38)", margin: 0, maxWidth: "26ch" }}>
                  We sent a magic link to <strong style={{ color: "rgba(255,255,255,0.55)", fontWeight: 400 }}>{magicEmail}</strong>. Click it to sign in.
                </p>
              </div>
              <button
                onClick={() => { setMagicSent(false); setMagicMode(false); setError(null); }}
                style={{
                  marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.30)",
                  background: "none", border: "none", cursor: "pointer", textDecoration: "underline",
                  textDecorationColor: "rgba(255,255,255,0.15)",
                }}
              >
                Back to sign in
              </button>
            </motion.div>

          ) : magicMode ? (

            /* ── Magic link form ──────────────────────────────────────────────── */
            <motion.div
              key="magic-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", margin: "0 0 4px", lineHeight: 1.6 }}>
                  Enter your email and we'll send you a sign-in link — no password needed.
                </p>
                <input
                  type="email"
                  name="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="Email"
                  value={magicEmail}
                  onChange={e => setMagicEmail(e.target.value)}
                  style={INPUT}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                />

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 13, background: "rgba(244,63,94,0.07)", border: "1px solid rgba(248,113,133,0.14)", color: "rgba(254,205,211,0.9)" }}
                    >
                      <AlertCircle size={13} strokeWidth={1.5} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={isPending}
                  whileHover={!isPending ? { scale: 1.01 } : {}}
                  whileTap={!isPending ? { scale: 0.98 } : {}}
                  style={{
                    height: 46, width: "100%", borderRadius: 12, border: "none",
                    background: isPending ? "rgba(139,92,246,0.25)" : "linear-gradient(90deg, #8b5cf6, #6366f1)",
                    color: "#fff", fontSize: 14, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.65 : 1, letterSpacing: "0.01em",
                    boxShadow: isPending ? "none" : "0 8px 28px rgba(99,102,241,0.26)",
                    transition: "opacity 0.15s",
                  }}
                >
                  {isPending ? "Sending…" : "Send magic link"}
                </motion.button>

                <button
                  type="button"
                  onClick={() => { setMagicMode(false); setError(null); }}
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", background: "none", border: "none", cursor: "pointer", marginTop: 2 }}
                >
                  ← Back to sign in
                </button>
              </form>
            </motion.div>

          ) : (

            /* ── Normal sign-in form ──────────────────────────────────────────── */
            <motion.div
              key="normal-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {/* Email confirmed banner */}
              <AnimatePresence>
                {confirmedBanner && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, fontSize: 13, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.20)", color: "rgba(167,243,208,0.92)", lineHeight: 1.65 }}
                  >
                    <CheckCircle size={15} style={{ marginTop: 1, flexShrink: 0, color: "#6ee7b7" }} />
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>Email confirmed</div>
                      Your email address has been verified. You can now sign in.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Kicked banner */}
              <AnimatePresence>
                {kickedBanner && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ padding: "12px 14px", borderRadius: 12, fontSize: 13, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(251,191,36,0.18)", color: "rgba(253,230,138,0.90)", lineHeight: 1.65 }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 3 }}>Session terminated</div>
                    Your session was revoked because your account signed in from another device. If this wasn't you, consider enabling 2FA.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Google + Apple buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  type="button"
                  onClick={handleGoogle}
                  disabled={isPending}
                  whileHover={!isPending ? { scale: 1.01, background: "rgba(255,255,255,0.088)" } : {}}
                  whileTap={!isPending ? { scale: 0.98 } : {}}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                    height: 46, flex: 1, borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: 400,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.55 : 1,
                    transition: "background 0.15s, opacity 0.15s",
                    letterSpacing: "0.01em",
                  }}
                >
                  <GoogleIcon />
                  Google
                </motion.button>

                <motion.button
                  type="button"
                  onClick={handleApple}
                  disabled={isPending}
                  whileHover={!isPending ? { scale: 1.01, background: "rgba(255,255,255,0.088)" } : {}}
                  whileTap={!isPending ? { scale: 0.98 } : {}}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                    height: 46, flex: 1, borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.82)", fontSize: 13, fontWeight: 400,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.55 : 1,
                    transition: "background 0.15s, opacity 0.15s",
                    letterSpacing: "0.01em",
                  }}
                >
                  <AppleIcon />
                  Apple
                </motion.button>
              </div>

              <OrDivider />

              {/* Email / password form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  style={INPUT}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.38)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                />

                {/* Password row with inline "Forgot?" */}
                <div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPw ? "text" : "password"}
                      name="password"
                      required
                      autoComplete="current-password"
                      placeholder="Password"
                      style={{ ...INPUT, paddingRight: 80 }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.38)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    />
                    {/* show/hide */}
                    <span
                      onClick={() => setShowPw(v => !v)}
                      style={{
                        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                        fontSize: 11, color: "rgba(255,255,255,0.28)", cursor: "pointer", userSelect: "none",
                      }}
                    >
                      {showPw ? "Hide" : "Show"}
                    </span>
                  </div>
                  {/* Forgot below field, right-aligned */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <Link
                      href="/forgot-password"
                      style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.60)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 13, background: "rgba(244,63,94,0.07)", border: "1px solid rgba(248,113,133,0.14)", color: "rgba(254,205,211,0.9)" }}
                    >
                      <AlertCircle size={13} strokeWidth={1.5} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CTA */}
                <motion.button
                  type="submit"
                  disabled={isPending}
                  whileHover={!isPending ? { scale: 1.01 } : {}}
                  whileTap={!isPending ? { scale: 0.98 } : {}}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    height: 46, width: "100%", borderRadius: 12, marginTop: 2, border: "none",
                    background: isPending ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.92)",
                    color: isPending ? "rgba(255,255,255,0.40)" : "#0a0a12",
                    fontSize: 14, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.65 : 1, letterSpacing: "0.01em",
                    transition: "opacity 0.15s",
                  }}
                >
                  {isPending ? "Signing in…" : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight size={14} strokeWidth={2} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Magic link toggle */}
              <button
                type="button"
                onClick={() => { setMagicMode(true); setError(null); }}
                style={{
                  fontSize: 13, color: "rgba(255,255,255,0.30)", background: "none", border: "none",
                  cursor: "pointer", textAlign: "center", marginTop: 2,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.60)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.30)")}
              >
                Use a magic link instead
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer link ─────────────────────────────────────────────────────── */}
      <p style={{ textAlign: "center", fontSize: 13, marginTop: 20, color: "rgba(255,255,255,0.24)" }}>
        No account?{" "}
        <Link
          href="/register"
          style={{ color: "rgba(255,255,255,0.50)", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
        >
          Request early access →
        </Link>
      </p>
    </motion.div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
