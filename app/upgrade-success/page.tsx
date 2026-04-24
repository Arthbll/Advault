"use client";

import { CheckCircle } from "lucide-react";

/**
 * Page affichée après un paiement Stripe réussi.
 * Placée hors du groupe (auth) pour éviter tout problème de session.
 * Pas d'auto-redirect — on laisse l'utilisateur cliquer pour éviter
 * les pertes de session lors d'une chaîne de redirections.
 */
export default function UpgradeSuccessPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgb(10,11,17)",
      padding: "0 24px",
    }}>
      <div style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        maxWidth: 420,
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: "rgba(16,185,129,0.10)",
          border: "1px solid rgba(52,211,153,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CheckCircle size={28} color="rgba(52,211,153,0.90)" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>
            Payment confirmed
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 200, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.92)", margin: 0 }}>
            Welcome to your new plan
          </h1>
        </div>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", lineHeight: 1.7, margin: 0 }}>
          Your subscription is now active. The engine will apply your new plan limits immediately.
        </p>

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", margin: 0 }}>
          It may take a few seconds for your plan to update in the dashboard.
        </p>

        <a
          href="/dashboard/settings?tab=plan"
          style={{
            padding: "10px 28px", borderRadius: 14,
            border: "1px solid rgba(52,211,153,0.20)",
            background: "rgba(16,185,129,0.08)",
            color: "rgba(52,211,153,0.85)",
            fontSize: 13, cursor: "pointer",
            textDecoration: "none", display: "inline-block",
          }}
        >
          Go to dashboard →
        </a>
      </div>
    </div>
  );
}
