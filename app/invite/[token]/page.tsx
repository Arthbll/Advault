"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type State = "loading" | "ready" | "accepting" | "done" | "error" | "needsLogin";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "otp">("otp");
  const [authError, setAuthError] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Check initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setState("ready");
      else setState("needsLogin");
    });

    // Also listen for auth changes — catches magic link redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setState("ready");
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAccept() {
    setState("accepting");
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? "Something went wrong");
        setState("error");
      } else {
        setState("done");
        setTimeout(() => router.replace("/dashboard"), 1500);
      }
    } catch {
      setErrorMsg("Network error");
      setState("error");
    }
  }

  async function handleAuth() {
    setAuthError("");
    const supabase = createClient();

    if (authMode === "otp") {
      // Magic link — works for new AND existing accounts, no email confirmation needed
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
        },
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setOtpSent(true);
      }
      return;
    }

    // Password sign-in (fallback for existing accounts)
    const authResult = await supabase.auth.signInWithPassword({ email, password });
    if (authResult.error) {
      setAuthError(authResult.error.message);
    } else {
      setState("ready");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d10",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
      color: "#fff",
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        borderRadius: 28, border: "1px solid rgba(255,255,255,0.09)",
        background: "linear-gradient(160deg,rgba(17,18,25,0.99),rgba(12,13,19,0.99))",
        padding: "36px 32px",
      }}>

        {/* Logo */}
        <div style={{ fontSize: 18, fontWeight: 400, color: "rgba(255,255,255,0.30)", letterSpacing: "-0.02em", marginBottom: 32 }}>
          ProfitDash
        </div>

        {state === "loading" && (
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14 }}>Loading…</p>
        )}

        {state === "needsLogin" && (
          <>
            <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>
              You've been invited
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", marginTop: 8, lineHeight: 1.7 }}>
              {otpSent
                ? "Check your email — we sent you a magic link. Click it to continue."
                : "Enter your email to receive a sign-in link. Works for new and existing accounts."}
            </p>

            {/* Mode toggle */}
            {!otpSent && (
              <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                {(["otp", "login"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setAuthMode(m); setAuthError(""); }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, cursor: "pointer",
                      border: authMode === m ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.07)",
                      background: authMode === m ? "rgba(255,255,255,0.07)" : "transparent",
                      color: authMode === m ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {m === "otp" ? "Magic link" : "Password"}
                  </button>
                ))}
              </div>
            )}

            {!otpSent && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAuth()}
                  style={inputStyle}
                />
                {authMode === "login" && (
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAuth()}
                    style={inputStyle}
                  />
                )}
              </div>
            )}

            {authError && (
              <p style={{ marginTop: 10, fontSize: 12, color: "rgba(251,113,133,0.9)" }}>{authError}</p>
            )}

            {!otpSent && (
              <button onClick={handleAuth} style={{ ...primaryBtn, marginTop: 20, width: "100%" }}>
                {authMode === "otp" ? "Send magic link →" : "Sign in & accept invite"}
              </button>
            )}

            {otpSent && (
              <button
                onClick={() => { setOtpSent(false); setEmail(""); }}
                style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer" }}
              >
                Use a different email
              </button>
            )}
          </>
        )}

        {state === "ready" && (
          <>
            <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: "-0.04em" }}>
              You've been invited
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", marginTop: 8, lineHeight: 1.7 }}>
              Accept this invitation to join the workspace. You'll have full access to all campaigns, analytics, and tools.
            </p>
            <button onClick={handleAccept} style={{ ...primaryBtn, marginTop: 28, width: "100%" }}>
              Accept invitation →
            </button>
          </>
        )}

        {state === "accepting" && (
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14 }}>Accepting invitation…</p>
        )}

        {state === "done" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(167,243,208,0.9)" }}>
              ✓ Invitation accepted
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 8 }}>
              Redirecting to dashboard…
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div style={{ fontSize: 22, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(251,113,133,0.9)" }}>
              Something went wrong
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 8 }}>{errorMsg}</p>
            <button onClick={() => setState("ready")} style={{ ...primaryBtn, marginTop: 20 }}>
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 12, padding: "11px 14px",
  fontSize: 13, color: "rgba(255,255,255,0.85)",
  outline: "none", width: "100%", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  borderRadius: 14, border: "none",
  background: "#ffffff",
  color: "#000000", padding: "12px 24px",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
