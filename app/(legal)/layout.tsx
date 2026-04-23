import type { ReactNode } from "react";
import Link from "next/link";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05060a",
      color: "rgba(255,255,255,0.88)",
      fontFamily: "var(--font-geist, system-ui, sans-serif)",
    }}>
      {/* Nav */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(5,6,10,0.90)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{
          margin: "0 auto", maxWidth: 1200, padding: "16px 40px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="logo-legal" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#logo-legal)" />
              <path d="M6 15L10 11L13 13L18 7" stroke="#0a0c10" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="18" cy="7" r="1.6" fill="#0a0c10" />
            </svg>
            <span style={{ fontSize: 18, letterSpacing: "-0.04em", fontWeight: 400, color: "rgba(255,255,255,0.92)" }}>
              <span>Profit</span><span style={{ color: "rgba(167,139,250,0.82)" }}>Dash</span>
            </span>
          </Link>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 40px",
        textAlign: "center",
        fontSize: 13,
        color: "rgba(255,255,255,0.28)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>© {new Date().getFullYear()} ProfitDash. All rights reserved.</span>
          <div style={{ display: "flex", gap: 24 }}>
            <Link href="/privacy" style={{ color: "rgba(255,255,255,0.28)", textDecoration: "none" }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: "rgba(255,255,255,0.28)", textDecoration: "none" }}>Terms of Service</Link>
            <a href="mailto:hello@profitdash.io" style={{ color: "rgba(255,255,255,0.28)", textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
