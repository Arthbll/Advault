"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { register, signInWithGoogle, signInWithApple } from "@/app/actions/auth";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

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

function LogoIcon({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg-register" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="10" fill="url(#lg-register)" />
      <polyline points="7,27 14,18 20,22 27,12 31,15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.92" />
      <circle cx="31" cy="15" r="2" fill="white" opacity="0.92" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function OrDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em", textTransform: "uppercase" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

const PLAN_META: Record<string, { label: string; color: string; note: string }> = {
  observer: { label: "Observer",  color: "rgba(255,255,255,0.55)", note: "Free — no credit card required" },
  operator: { label: "Operator",  color: "rgba(196,181,253,1)",    note: "€99/month · billed after your free period" },
  dominion: { label: "Dominion",  color: "rgba(74,222,128,0.90)",  note: "€249/month · billed after your free period" },
};

function RegisterInner() {
  const searchParams = useSearchParams();
  const planKey  = (searchParams.get("plan") ?? "observer").toLowerCase();
  const planMeta = PLAN_META[planKey] ?? PLAN_META.observer;

  const [error,    setError]   = useState<string | null>(null);
  const [success,  setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPw,   setShowPw]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm  = formData.get("confirm")  as string;
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    startTransition(async () => {
      const result = await register(formData);
      if (result?.error)   setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithGoogle();
      if (result?.error) setError(result.error);
    });
  }

  function handleApple() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithApple();
      if (result?.error) setError(result.error);
    });
  }

  const OAuthBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <motion.button
      type="button"
      onClick={onClick}
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
      {children}
    </motion.button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      style={{ width: "100%", maxWidth: 420 }}
    >
      <AnimatePresence mode="wait">

        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{
              background: "linear-gradient(180deg, rgba(18,19,28,0.97) 0%, rgba(10,11,18,0.99) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 24,
              boxShadow: "0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
              padding: "48px 32px 40px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 20, textAlign: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 20 }}
              style={{ width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.16)" }}
            >
              <CheckCircle size={22} strokeWidth={1.5} style={{ color: "#4ade80" }} />
            </motion.div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 300, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.92)", margin: "0 0 10px" }}>Account created.</p>
              <p style={{ fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.38)", margin: 0, maxWidth: "26ch" }}>Check your inbox and click the confirmation link to activate your account.</p>
              {planKey !== "observer" && (
                <p style={{ fontSize: 12, marginTop: 8, lineHeight: 1.65, color: "rgba(255,255,255,0.22)", maxWidth: "26ch" }}>Your {planMeta.label} plan will be set up after confirmation.</p>
              )}
            </div>
            <Link
              href="/login"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 42, borderRadius: 12, padding: "0 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", fontSize: 13, color: "rgba(255,255,255,0.50)", textDecoration: "none", transition: "color 0.15s, background 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.50)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            >
              Go to sign in →
            </Link>
          </motion.div>

        ) : (

          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{
              background: "linear-gradient(180deg, rgba(18,19,28,0.97) 0%, rgba(10,11,18,0.99) 100%)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 24,
              boxShadow: "0 32px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
              padding: "32px 32px 28px",
              display: "flex", flexDirection: "column", gap: 0,
            }}>
              {/* Logo + wordmark */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
                <LogoIcon size={38} />
                <div>
                  <p style={{ fontSize: 18, fontWeight: 300, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.92)", margin: 0, lineHeight: 1 }}>ProfitDash</p>
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.20em", color: "rgba(255,255,255,0.22)", margin: "4px 0 0" }}>Campaign decision engine</p>
                </div>
              </div>

              {/* Headline + plan badge */}
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.90)", margin: "0 0 10px", lineHeight: 1.2 }}>Create your account.</p>
                {planKey !== "observer" ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>Plan selected:</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: planMeta.color }}>{planMeta.label}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.22)" }}>— {planMeta.note}</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", margin: 0 }}>Free — no credit card required</p>
                )}
              </div>

              {/* Google + Apple */}
              <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
                <OAuthBtn onClick={handleGoogle}><GoogleIcon /> Google</OAuthBtn>
                <OAuthBtn onClick={handleApple}><AppleIcon /> Apple</OAuthBtn>
              </div>

              <OrDivider />

              {/* Email + password form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email" name="email" required autoComplete="email"
                  placeholder="Email"
                  style={INPUT}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.38)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                />

                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"} name="password" required autoComplete="new-password"
                    placeholder="Password — 8 characters minimum"
                    style={{ ...INPUT, paddingRight: 60 }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.38)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                  <span onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "rgba(255,255,255,0.28)", cursor: "pointer", userSelect: "none" }}>
                    {showPw ? "Hide" : "Show"}
                  </span>
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    type={showConf ? "text" : "password"} name="confirm" required autoComplete="new-password"
                    placeholder="Confirm password"
                    style={{ ...INPUT, paddingRight: 60 }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.38)"; e.currentTarget.style.background = "rgba(255,255,255,0.055)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                  <span onClick={() => setShowConf(v => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "rgba(255,255,255,0.28)", cursor: "pointer", userSelect: "none" }}>
                    {showConf ? "Hide" : "Show"}
                  </span>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 13, background: "rgba(244,63,94,0.07)", border: "1px solid rgba(248,113,133,0.14)", color: "rgba(254,205,211,0.9)" }}
                    >
                      <AlertCircle size={13} strokeWidth={1.5} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit" disabled={isPending}
                  whileHover={!isPending ? { scale: 1.01 } : {}}
                  whileTap={!isPending ? { scale: 0.98 } : {}}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    height: 46, width: "100%", borderRadius: 12, marginTop: 4, border: "none",
                    background: isPending ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.92)",
                    color: isPending ? "rgba(255,255,255,0.40)" : "#0a0a12",
                    fontSize: 14, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.65 : 1, letterSpacing: "0.01em", transition: "opacity 0.15s",
                  }}
                >
                  {isPending ? "Creating account…" : <><span>Create account</span><ArrowRight size={14} strokeWidth={2} /></>}
                </motion.button>

                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.20)", textAlign: "center", marginTop: 4, lineHeight: 1.6 }}>
                  By creating an account you agree to our{" "}
                  <Link href="/terms" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Terms</Link>
                  {" "}and{" "}
                  <Link href="/privacy" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Privacy Policy</Link>.
                </p>
              </form>
            </div>

            <p style={{ textAlign: "center", fontSize: 13, marginTop: 20, color: "rgba(255,255,255,0.24)" }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "rgba(255,255,255,0.50)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.85)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
              >
                Sign in →
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
