"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 18px",
  borderRadius: 16,
  fontSize: 14,
  outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(255,255,255,0.88)",
  transition: "border-color 0.18s, background 0.18s",
  boxSizing: "border-box",
  colorScheme: "dark",
  letterSpacing: "0.01em",
};

function s(i: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: i * 0.08, ease: EASE },
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);
  const [showPw,    setShowPw]    = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await resetPassword(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => router.push("/dashboard"), 2200);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: 480 }}>

      {/* Badge */}
      <motion.div {...s(0)} style={{ marginBottom: 24 }}>
        <span style={{
          display: "inline-flex", alignItems: "center",
          borderRadius: 999, border: "1px solid rgba(139,92,246,0.20)",
          background: "rgba(139,92,246,0.08)", padding: "6px 18px",
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.24em", color: "rgba(196,181,253,1)",
        }}>
          New password
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1 {...s(1)} style={{
        fontSize: 44, fontWeight: 200, letterSpacing: "-0.055em",
        lineHeight: 1, color: "rgba(255,255,255,0.92)",
        textAlign: "center", margin: "0 0 16px", maxWidth: "14ch",
      }}>
        Choose a new password.
      </motion.h1>

      <motion.p {...s(2)} style={{
        fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.34)",
        textAlign: "center", margin: "0 0 36px", maxWidth: "28ch",
      }}>
        Your new password must be at least 8 characters.
      </motion.p>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
        style={{
          width: "100%",
          background: "linear-gradient(180deg, rgba(16,17,25,0.96) 0%, rgba(9,10,16,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 28,
          boxShadow: "0 30px 90px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
          padding: "32px",
        }}
      >
        <AnimatePresence mode="wait">
          {done ? (
            /* ── Success state ── */
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", padding: "12px 0" }}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 20 }}
                style={{
                  width: 52, height: 52, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(74,222,128,0.07)",
                  border: "1px solid rgba(74,222,128,0.14)",
                }}
              >
                <CheckCircle size={22} strokeWidth={1.5} style={{ color: "#4ade80" }} />
              </motion.div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 300, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.90)", margin: 0 }}>
                  Password updated.
                </p>
                <p style={{ fontSize: 13, marginTop: 10, color: "rgba(255,255,255,0.32)", lineHeight: 1.65 }}>
                  Redirecting you to the dashboard…
                </p>
              </div>
            </motion.div>
          ) : (
            /* ── Form state ── */
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.90)", margin: "0 0 6px" }}>
                ProfitDash
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.30)", margin: "0 0 24px" }}>
                Enter and confirm your new password.
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* New password */}
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    name="password"
                    required
                    autoComplete="new-password"
                    placeholder="New password"
                    style={INPUT}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)";
                      e.currentTarget.style.background  = "rgba(255,255,255,0.055)";
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                      e.currentTarget.style.background  = "rgba(255,255,255,0.04)";
                    }}
                  />
                  <span
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position: "absolute", right: 18, top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 11, color: "rgba(255,255,255,0.32)",
                      cursor: "pointer", userSelect: "none",
                    }}
                  >
                    {showPw ? "Hide" : "Show"}
                  </span>
                </div>

                {/* Confirm password */}
                <input
                  type={showPw ? "text" : "password"}
                  name="confirm"
                  required
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  style={INPUT}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "rgba(139,92,246,0.40)";
                    e.currentTarget.style.background  = "rgba(255,255,255,0.055)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                    e.currentTarget.style.background  = "rgba(255,255,255,0.04)";
                  }}
                />

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "11px 16px", borderRadius: 12, fontSize: 13,
                        background: "rgba(244,63,94,0.07)",
                        border: "1px solid rgba(248,113,133,0.16)",
                        color: "rgba(254,205,211,0.9)",
                      }}
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
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, height: 52, width: "100%", borderRadius: 16,
                    marginTop: 4, border: "none",
                    background: isPending
                      ? "rgba(99,102,241,0.30)"
                      : "linear-gradient(90deg, #8b5cf6, #6366f1, #38bdf8)",
                    color: "#fff", fontSize: 14, fontWeight: 600,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.65 : 1,
                    boxShadow: isPending ? "none" : "0 18px 50px rgba(99,102,241,0.30)",
                    transition: "opacity 0.15s",
                  }}
                >
                  {isPending ? "Updating…" : (
                    <>
                      <span>Update password</span>
                      <ArrowRight size={14} strokeWidth={2} />
                    </>
                  )}
                </motion.button>

                <p style={{ textAlign: "center", fontSize: 13, marginTop: 4, color: "rgba(255,255,255,0.28)" }}>
                  <Link href="/login" style={{ color: "rgba(255,255,255,0.48)", textDecoration: "none" }}>
                    ← Back to sign in
                  </Link>
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
