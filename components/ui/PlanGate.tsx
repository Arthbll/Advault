"use client";

/**
 * components/ui/PlanGate.tsx
 *
 * Composant réutilisable qui bloque visuellement l'accès à une feature
 * si l'utilisateur n'a pas le plan requis.
 *
 * Deux modes :
 *   - overlay (default) : blur + cadenas + bouton Upgrade centré sur le contenu
 *   - inline            : juste griser + curseur not-allowed (pour boutons, toggles)
 *
 * Usage :
 *   <PlanGate planId={planId} requiredPlan="dominion" feature="Automatic Mode">
 *     <MonComposant />
 *   </PlanGate>
 */

import { Lock } from "lucide-react";
import Link from "next/link";
import { PlanId, PLANS, hasAccess } from "@/lib/plans";

interface PlanGateProps {
  children: React.ReactNode;
  /** Plan actuel de l'utilisateur */
  planId: PlanId;
  /** Plan minimum requis pour accéder à cette feature */
  requiredPlan: "operator" | "dominion";
  /** Nom de la feature affiché dans l'overlay */
  feature: string;
  /** Sous-texte optionnel affiché sous le nom de la feature */
  description?: string;
  /** Mode inline : grise le contenu sans overlay (pour boutons/toggles) */
  inline?: boolean;
  /** Masque complètement au lieu de flouter (pour contenu très sensible) */
  hide?: boolean;
}

export default function PlanGate({
  children,
  planId,
  requiredPlan,
  feature,
  description,
  inline = false,
  hide = false,
}: PlanGateProps) {
  // Si l'utilisateur a le bon plan → afficher le contenu normalement
  if (hasAccess(planId, requiredPlan)) return <>{children}</>;

  const requiredPlanConfig = PLANS[requiredPlan];

  // ── Mode inline : grise + curseur not-allowed ──────────────────────────────
  if (inline) {
    return (
      <div
        style={{
          position: "relative",
          opacity: 0.4,
          pointerEvents: "none",
          cursor: "not-allowed",
          userSelect: "none",
        }}
        title={`${feature} — ${requiredPlanConfig.upgradeLabel}`}
      >
        {children}
      </div>
    );
  }

  // ── Mode overlay : blur + cadenas centré ───────────────────────────────────
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>

      {/* Contenu flouté en arrière-plan */}
      <div
        style={{
          filter: hide ? "none" : "blur(6px)",
          opacity: hide ? 0 : 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {children}
      </div>

      {/* Overlay cadenas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(13,13,16,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          gap: 14,
          padding: 24,
        }}
      >
        {/* Icône cadenas */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Lock size={20} strokeWidth={1.4} color="rgba(255,255,255,0.45)" />
        </div>

        {/* Texte */}
        <div style={{ textAlign: "center", maxWidth: 280 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "rgba(255,255,255,0.88)",
              margin: "0 0 5px",
              letterSpacing: "-0.02em",
            }}
          >
            {feature}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.38)",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {description ?? `Available on ${requiredPlanConfig.label} and above.`}
          </p>
        </div>

        {/* Bouton upgrade */}
        <Link
          href="/dashboard/settings?tab=plan"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 20px",
            borderRadius: 99,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.13)",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            textDecoration: "none",
            letterSpacing: "-0.01em",
            transition: "background 0.15s, border-color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.13)";
          }}
        >
          <Lock size={10} strokeWidth={2} />
          {requiredPlanConfig.upgradeLabel}
        </Link>
      </div>
    </div>
  );
}
