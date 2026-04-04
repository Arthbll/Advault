"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { register } from "@/app/actions/auth";

// ─── Orbit mark — same as login page ─────────────────────────────────────────
function OrbitMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      style={{ overflow: "visible" }}
    >
      <ellipse cx="17" cy="17" rx="14" ry="5.5" stroke="#8b5cf6" strokeWidth="1" opacity="0.55" />
      <ellipse cx="17" cy="17" rx="5.5" ry="14" stroke="#0ea5e9" strokeWidth="1" opacity="0.45" />
      <circle cx="17" cy="17" r="1.5" fill="white" opacity="0.65" />
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#3f3f46",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  fontSize: 13,
  outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  color: "rgba(255,255,255,0.88)",
  transition: "border-color 0.18s, background 0.18s",
  boxSizing: "border-box",
  colorScheme: "dark",
  letterSpacing: "0.01em",
};

const FIELDS = [
  { label: "Email",            type: "email",    name: "email",    placeholder: "you@domain.com",       autoComplete: "email" },
  { label: "Password",         type: "password", name: "password", placeholder: "8 characters minimum", autoComplete: "new-password" },
  { label: "Confirm password", type: "password", name: "confirm",  placeholder: "••••••••",             autoComplete: "new-password" },
];

// ─── Plan metadata ────────────────────────────────────────────────────────────
const PLAN_META: Record<string, { label: string; color: string; note: string }> = {
  observer:  { label: "Observer",  color: "rgba(255,255,255,0.30)", note: "Free — no credit card required" },
  operator:  { label: "Operator",  color: "rgba(255,255,255,0.65)", note: "€99/month · billed after your free period" },
  dominion:  { label: "Dominion",  color: "rgba(74,222,128,0.80)",  note: "€249/month · billed after your free period" },
};

// ─── Inner page (needs useSearchParams) ───────────────────────────────────────
function RegisterInner() {
  const searchParams = useSearchParams();
  const planKey      = (searchParams.get("plan") ?? "observer").toLowerCase();
  const planMeta     = PLAN_META[planKey] ?? PLAN_META.observer;

  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm  = formData.get("confirm")  as string;
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    startTransition(async () => {
      const result = await register(formData);
      if (result?.error)   setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE }}
      style={{ width: "100%" }}
    >
      <AnimatePresence mode="wait">

        {/* ── Success state ──────────────────────────────────────────────────── */}
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              textAlign: "center",
              paddingTop: 40,
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 20 }}
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(74,222,128,0.07)",
                border: "1px solid rgba(74,222,128,0.14)",
              }}
            >
              <CheckCircle size={22} strokeWidth={1.5} style={{ color: "#4ade80" }} />
            </motion.div>
            <div>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 300,
                  letterSpacing: "-0.03em",
                  color: "rgba(255,255,255,0.92)",
                  margin: 0,
                }}
              >
                Account created.
              </p>
              <p
                style={{
                  fontSize: 13,
                  marginTop: 10,
                  lineHeight: 1.75,
                  color: "rgba(255,255,255,0.38)",
                  maxWidth: "28ch",
                }}
              >
                Check your inbox and confirm your email to activate your account.
              </p>
              {planKey !== "observer" && (
                <p style={{
                  fontSize: 12, marginTop: 8, lineHeight: 1.65,
                  color: "rgba(255,255,255,0.24)", maxWidth: "28ch",
                }}>
                  Your {planMeta.label} plan will be set up after confirmation.
                </p>
              )}
            </div>
            <Link
              href="/login"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 42, borderRadius: 12, padding: "0 20px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                fontSize: 13, color: "rgba(255,255,255,0.55)",
                textDecoration: "none", transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }}
            >
              Go to sign in →
            </Link>
          </motion.div>

        ) : (

          /* ── Form state ────────────────────────────────────────────────────── */
          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Mark + wordmark + headline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                marginBottom: 42,
                textAlign: "center",
              }}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 280 }}
              >
                <OrbitMark size={36} />
              </motion.div>

              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    letterSpacing: "0.06em",
                    color: "rgba(255,255,255,0.22)",
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  ProfitDash
                </p>
                <h1
                  style={{
                    fontSize: 24,
                    fontWeight: 300,
                    letterSpacing: "-0.04em",
                    color: "rgba(255,255,255,0.92)",
                    margin: "10px 0 0",
                    lineHeight: 1.15,
                  }}
                >
                  Create your account.
                </h1>
                {planKey !== "observer" && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    marginTop: 10, padding: "4px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(255,255,255,0.30)" }}>Plan selected</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: planMeta.color }}>{planMeta.label}</span>
                  </div>
                )}
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.26)",
                    margin: "10px 0 0",
                    letterSpacing: "0.01em",
                    lineHeight: 1.5,
                  }}
                >
                  {planMeta.note}
                </p>
              </div>
            </div>

            {/* Fields */}
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {FIELDS.map(({ label, type, name, placeholder, autoComplete }) => (
                <div key={name}>
                  <label style={{ ...LABEL, display: "block", marginBottom: 7 }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    name={name}
                    required
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    style={INPUT}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = "rgba(139,92,246,0.38)";
                      e.currentTarget.style.background  = "rgba(255,255,255,0.055)";
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.background  = "rgba(255,255,255,0.04)";
                    }}
                  />
                </div>
              ))}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 13px",
                      borderRadius: 10,
                      fontSize: 12,
                      background: "rgba(248,113,113,0.07)",
                      border: "1px solid rgba(248,113,113,0.12)",
                      color: "#f87171",
                    }}
                  >
                    <AlertCircle size={12} strokeWidth={1.5} />
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "13px",
                  borderRadius: 11,
                  marginTop: 4,
                  background: isPending
                    ? "rgba(139,92,246,0.22)"
                    : "linear-gradient(135deg, rgba(139,92,246,0.82) 0%, rgba(99,102,241,0.78) 50%, rgba(14,165,233,0.68) 100%)",
                  border: "1px solid rgba(139,92,246,0.28)",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 13,
                  fontWeight: 400,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.65 : 1,
                  transition: "opacity 0.15s",
                  letterSpacing: "0.015em",
                  boxShadow: isPending
                    ? "none"
                    : "0 4px 24px rgba(139,92,246,0.14), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                {isPending ? (
                  "Creating account…"
                ) : (
                  <>
                    <span>Create account</span>
                    <ArrowRight size={13} strokeWidth={1.5} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Back to login */}
            <p
              style={{
                textAlign: "center",
                fontSize: 11,
                marginTop: 30,
                color: "rgba(255,255,255,0.10)",
                letterSpacing: "0.01em",
              }}
            >
              Already have an account?{" "}
              <Link
                href="/login"
                style={{
                  color: "rgba(255,255,255,0.28)",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.color = "rgba(255,255,255,0.55)")
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.color = "rgba(255,255,255,0.28)")
                }
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

// ─── Page export with Suspense boundary for useSearchParams ───────────────────
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
