"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle } from "lucide-react";
import { login } from "@/app/actions/auth";

// ─── Styles ───────────────────────────────────────────────────────────────────
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

// ─── Stagger helper ───────────────────────────────────────────────────────────
function s(i: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: i * 0.08, ease: EASE },
  };
}

// ─── Page (inner) ─────────────────────────────────────────────────────────────
// Séparé en composant interne pour satisfaire la règle Suspense de Next.js 16 :
// useSearchParams() doit toujours être dans un composant enveloppé par <Suspense>.
function LoginPageInner() {
  const [error, setError]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPw, setShowPw]         = useState(false);
  const [kickedBanner, setKickedBanner] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get("reason") === "kicked") {
      setKickedBanner(true);
    }
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: 480,
      }}
    >
      {/* ── Badge ─────────────────────────────────────────────────────────── */}
      <motion.div {...s(0)} style={{ marginBottom: 24 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            border: "1px solid rgba(139,92,246,0.20)",
            background: "rgba(139,92,246,0.08)",
            padding: "6px 18px",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.24em",
            color: "rgba(196,181,253,1)",
          }}
        >
          Private access
        </span>
      </motion.div>

      {/* ── Headline ──────────────────────────────────────────────────────── */}
      <motion.h1 {...s(1)}
        style={{
          fontSize: 58,
          fontWeight: 200,
          letterSpacing: "-0.065em",
          lineHeight: 0.92,
          color: "rgba(255,255,255,0.92)",
          textAlign: "center",
          margin: "0 0 18px",
          maxWidth: "10ch",
        }}
      >
        See what deserves action.
      </motion.h1>

      {/* ── Sub ───────────────────────────────────────────────────────────── */}
      <motion.p {...s(2)}
        style={{
          fontSize: 16,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.34)",
          textAlign: "center",
          margin: "0 0 36px",
          maxWidth: "34ch",
        }}
      >
        The operating layer between traffic and profit.
      </motion.p>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
        style={{
          width: "100%",
          background:
            "linear-gradient(180deg, rgba(16,17,25,0.96) 0%, rgba(9,10,16,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 28,
          boxShadow:
            "0 30px 90px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
          padding: "32px",
        }}
      >
        {/* Wordmark row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "linear-gradient(145deg, #8b5cf6, #2563eb, #38bdf8)",
              boxShadow: "0 10px 28px rgba(99,102,241,0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 600,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            P
          </div>
          <div>
            <p
              style={{
                fontSize: 26,
                fontWeight: 200,
                letterSpacing: "-0.05em",
                color: "rgba(255,255,255,0.92)",
                margin: 0,
                lineHeight: 1,
              }}
            >
              ProfitDash
            </p>
            <p
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: "rgba(255,255,255,0.26)",
                margin: "5px 0 0",
              }}
            >
              Decision engine for media buyers
            </p>
          </div>
        </div>

        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 28,
              fontWeight: 200,
              letterSpacing: "-0.04em",
              color: "rgba(255,255,255,0.92)",
              margin: "0 0 8px",
            }}
          >
            Welcome back
          </p>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.34)",
              margin: 0,
            }}
          >
            Get back to the signal, the engine, and the campaigns that need action.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="Email"
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

          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              name="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              style={{ ...INPUT, paddingRight: 60 }}
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
                position: "absolute",
                right: 18,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                color: "rgba(255,255,255,0.32)",
                cursor: "pointer",
                userSelect: "none",
                transition: "color 0.15s",
              }}
            >
              {showPw ? "Hide" : "Show"}
            </span>
          </div>

          {/* Kicked banner — another device signed in with the same credentials */}
          <AnimatePresence>
            {kickedBanner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  fontSize: 13,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(251,191,36,0.20)",
                  color: "rgba(253,230,138,0.95)",
                  lineHeight: 1.65,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Session terminated</div>
                Your account was signed in from another device and your session has been revoked.
                If this wasn't you, your credentials may have been shared. Consider enabling 2FA or upgrading to the Command plan for proper team access.
              </motion.div>
            )}
          </AnimatePresence>

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
                  padding: "11px 16px",
                  borderRadius: 12,
                  fontSize: 13,
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

          {/* Forgot password */}
          <div style={{ padding: "2px 2px" }}>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.32)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.65)")
              }
              onMouseLeave={e =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.32)")
              }
            >
              Forgot password?
            </Link>
          </div>

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
              height: 52,
              width: "100%",
              borderRadius: 16,
              marginTop: 4,
              border: "none",
              background: isPending
                ? "rgba(99,102,241,0.30)"
                : "linear-gradient(90deg, #8b5cf6, #6366f1, #38bdf8)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.65 : 1,
              letterSpacing: "0.01em",
              boxShadow: isPending
                ? "none"
                : "0 18px 50px rgba(99,102,241,0.30)",
              transition: "opacity 0.15s",
            }}
          >
            {isPending ? (
              "Signing in…"
            ) : (
              <>
                <span>Sign in to ProfitDash</span>
                <ArrowRight size={14} strokeWidth={2} />
              </>
            )}
          </motion.button>

          {/* Request access */}
          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              marginTop: 4,
              color: "rgba(255,255,255,0.28)",
            }}
          >
            No account yet?{" "}
            <Link
              href="/register"
              style={{
                color: "rgba(255,255,255,0.62)",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.90)")
              }
              onMouseLeave={e =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.62)")
              }
            >
              Request access
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────
// Enveloppe LoginPageInner dans <Suspense> pour satisfaire la règle Next.js 16 :
// useSearchParams() doit toujours être dans un arbre Suspense.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
