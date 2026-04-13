"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, AlertCircle, KeyRound, ArrowLeft } from "lucide-react";
import { listMFAFactors, verifyMFA } from "@/app/actions/mfa";
import { setTrustedDevice } from "@/app/actions/trusted-device";
import { useRecoveryCode } from "@/app/actions/recovery-codes";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

export default function MFAChallengePageWrapper() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const router = useRouter();

  useEffect(() => {
    listMFAFactors().then(res => {
      if (res.factors.length > 0) {
        setFactorId(res.factors[0].id);
      } else {
        router.replace("/dashboard");
      }
      setLoading(false);
    });
  }, [router]);

  if (loading || !factorId) return null;
  return <MFAChallengePage factorId={factorId} />;
}

type Mode = "totp" | "recovery";

function MFAChallengePage({ factorId }: { factorId: string }) {
  const [mode, setMode]               = useState<Mode>("totp");
  const [code, setCode]               = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();
  const [remember, setRemember]       = useState(true);
  const router = useRouter();
  const inputRef    = useRef<HTMLInputElement>(null);
  const recoveryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    setError(null);
    if (mode === "totp") setTimeout(() => inputRef.current?.focus(), 80);
    else                  setTimeout(() => recoveryRef.current?.focus(), 80);
  }, [mode]);

  // ── TOTP submit ──────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\s/g, "").length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await verifyMFA(factorId, code);
      if (res.error) {
        setError("Invalid code. Please try again.");
        setCode("");
        inputRef.current?.focus();
      } else {
        if (remember) await setTrustedDevice();
        router.replace("/dashboard");
      }
    });
  }

  // ── Recovery code submit ─────────────────────────────────────────────────────
  function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (recoveryInput.trim().replace(/[^A-Z0-9a-z]/g, "").length < 8) {
      setError("Please enter a valid recovery code (e.g. ABCDE-FGHIJ).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await useRecoveryCode(recoveryInput);
      if (res.error) {
        setError(res.error);
        setRecoveryInput("");
        recoveryRef.current?.focus();
      } else {
        // useRecoveryCode already sets trusted-device cookie (30 days)
        router.replace("/dashboard");
      }
    });
  }

  function handleChange(v: string) {
    setCode(v.replace(/\D/g, "").slice(0, 6));
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      width: "100%", maxWidth: 440,
    }}>
      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{
          width: 64, height: 64, borderRadius: 20, marginBottom: 28,
          background: mode === "totp"
            ? "linear-gradient(145deg,rgba(52,211,153,0.18),rgba(16,185,129,0.06))"
            : "linear-gradient(145deg,rgba(139,92,246,0.18),rgba(109,40,217,0.06))",
          border: mode === "totp"
            ? "1px solid rgba(52,211,153,0.22)"
            : "1px solid rgba(139,92,246,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.3s",
        }}
      >
        {mode === "totp"
          ? <ShieldCheck size={28} strokeWidth={1.5} color="rgba(110,231,183,0.9)" />
          : <KeyRound    size={28} strokeWidth={1.5} color="rgba(196,181,253,0.9)" />
        }
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
        style={{ fontSize: 36, fontWeight: 200, letterSpacing: "-0.05em", textAlign: "center", margin: "0 0 10px" }}
      >
        {mode === "totp" ? "Two-factor auth" : "Recovery code"}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.14, ease: EASE }}
        style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", textAlign: "center", margin: "0 0 32px", lineHeight: 1.7 }}
      >
        {mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of your saved recovery codes to sign in."}
      </motion.p>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
        style={{
          width: "100%",
          background: "linear-gradient(180deg,rgba(16,17,25,0.97),rgba(9,10,16,0.99))",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 28,
          boxShadow: "0 28px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.07)",
          padding: 32,
        }}
      >
        <AnimatePresence mode="wait">

          {/* ── TOTP form ────────────────────────────────────────────────── */}
          {mode === "totp" && (
            <motion.form
              key="totp"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <input
                ref={inputRef}
                type="text" inputMode="numeric" autoComplete="one-time-code"
                placeholder="000000" value={code}
                onChange={e => handleChange(e.target.value)}
                disabled={isPending}
                style={{
                  width: "100%", height: 64, boxSizing: "border-box", padding: "0 20px",
                  borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 28, fontWeight: 200, letterSpacing: "0.35em",
                  outline: "none", textAlign: "center",
                  colorScheme: "dark" as never, transition: "border-color 0.15s",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(52,211,153,0.40)"; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "11px 16px",
                      borderRadius: 12, fontSize: 13,
                      background: "rgba(244,63,94,0.07)", border: "1px solid rgba(248,113,133,0.16)",
                      color: "rgba(254,205,211,0.9)",
                    }}
                  >
                    <AlertCircle size={13} strokeWidth={1.5} />{error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit" disabled={isPending || code.length < 6}
                whileHover={!isPending && code.length >= 6 ? { scale: 1.01 } : {}}
                whileTap={!isPending && code.length >= 6 ? { scale: 0.98 } : {}}
                style={{
                  height: 52, width: "100%", borderRadius: 16, border: "none", marginTop: 4,
                  background: isPending || code.length < 6
                    ? "rgba(52,211,153,0.18)"
                    : "linear-gradient(90deg,rgba(16,185,129,0.9),rgba(52,211,153,0.85))",
                  color: isPending || code.length < 6 ? "rgba(110,231,183,0.45)" : "#fff",
                  fontSize: 14, fontWeight: 600,
                  cursor: isPending || code.length < 6 ? "not-allowed" : "pointer",
                  boxShadow: isPending || code.length < 6 ? "none" : "0 14px 40px rgba(16,185,129,0.25)",
                  transition: "all 0.15s",
                }}
              >
                {isPending ? "Verifying…" : "Verify & sign in"}
              </motion.button>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 4 }}>
                <input
                  type="checkbox" checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "rgba(52,211,153,0.85)", cursor: "pointer" }}
                />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", userSelect: "none" }}>
                  Remember this device for 30 days
                </span>
              </label>
            </motion.form>
          )}

          {/* ── Recovery code form ────────────────────────────────────────── */}
          {mode === "recovery" && (
            <motion.form
              key="recovery"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRecoverySubmit}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{
                padding: "10px 14px", borderRadius: 11, marginBottom: 4,
                background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.16)",
                fontSize: 11, color: "rgba(196,181,253,0.65)", lineHeight: 1.6,
              }}>
                Each code can only be used once. Format: <span style={{ fontFamily: "monospace", letterSpacing: "0.1em", color: "rgba(196,181,253,0.9)" }}>XXXXX-XXXXX</span>
              </div>

              <input
                ref={recoveryRef}
                type="text" autoComplete="off" spellCheck={false}
                placeholder="ABCDE-FGHIJ"
                value={recoveryInput}
                onChange={e => setRecoveryInput(e.target.value.toUpperCase())}
                disabled={isPending}
                style={{
                  width: "100%", height: 56, boxSizing: "border-box", padding: "0 20px",
                  borderRadius: 16, border: "1px solid rgba(139,92,246,0.22)",
                  background: "rgba(139,92,246,0.04)",
                  color: "rgba(255,255,255,0.88)",
                  fontFamily: "monospace", fontSize: 18, fontWeight: 400, letterSpacing: "0.18em",
                  outline: "none", textAlign: "center",
                  colorScheme: "dark" as never, transition: "border-color 0.15s",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)"; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.22)"; }}
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "11px 16px",
                      borderRadius: 12, fontSize: 13,
                      background: "rgba(244,63,94,0.07)", border: "1px solid rgba(248,113,133,0.16)",
                      color: "rgba(254,205,211,0.9)",
                    }}
                  >
                    <AlertCircle size={13} strokeWidth={1.5} />{error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit" disabled={isPending || recoveryInput.trim().length < 8}
                whileHover={!isPending && recoveryInput.trim().length >= 8 ? { scale: 1.01 } : {}}
                whileTap={!isPending && recoveryInput.trim().length >= 8 ? { scale: 0.98 } : {}}
                style={{
                  height: 52, width: "100%", borderRadius: 16, border: "none", marginTop: 4,
                  background: isPending || recoveryInput.trim().length < 8
                    ? "rgba(139,92,246,0.14)"
                    : "linear-gradient(90deg,rgba(109,40,217,0.85),rgba(139,92,246,0.80))",
                  color: isPending || recoveryInput.trim().length < 8 ? "rgba(196,181,253,0.4)" : "#fff",
                  fontSize: 14, fontWeight: 600,
                  cursor: isPending || recoveryInput.trim().length < 8 ? "not-allowed" : "pointer",
                  boxShadow: isPending || recoveryInput.trim().length < 8 ? "none" : "0 14px 40px rgba(109,40,217,0.28)",
                  transition: "all 0.15s",
                }}
              >
                {isPending ? "Verifying…" : "Use recovery code"}
              </motion.button>
            </motion.form>
          )}

        </AnimatePresence>

        {/* ── Mode switcher ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          {mode === "totp" ? (
            <button
              type="button"
              onClick={() => setMode("recovery")}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 12, color: "rgba(255,255,255,0.30)",
                display: "inline-flex", alignItems: "center", gap: 6, transition: "color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "rgba(196,181,253,0.75)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.30)"; }}
            >
              <KeyRound size={13} strokeWidth={1.5} />
              Use a recovery code instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("totp")}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 12, color: "rgba(255,255,255,0.30)",
                display: "inline-flex", alignItems: "center", gap: 6, transition: "color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "rgba(110,231,183,0.75)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.30)"; }}
            >
              <ArrowLeft size={13} strokeWidth={1.5} />
              Back to authenticator code
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
