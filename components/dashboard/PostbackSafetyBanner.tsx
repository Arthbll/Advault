"use client";

/**
 * Bannière de sécurité postback.
 *
 * Trois états possibles :
 *   1. Rien (defaultcase) — user avec postback OK, rien à afficher
 *   2. Ambre — grace period active, pas encore de postback reçu → prévention
 *   3. Rouge — engine a été downgradé auto (aucun postback après 48h) → alerte
 *
 * Se branche sur /api/postback/status (GET). À poser dans le layout dashboard
 * au-dessus du contenu principal, ou juste sous la bannière AlertBanner.
 *
 * Usage :
 *   import PostbackSafetyBanner from "@/components/dashboard/PostbackSafetyBanner";
 *   <PostbackSafetyBanner />
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import Link from "next/link";

interface PostbackStatus {
  hasAnyPostback:           boolean;
  inGracePeriod:            boolean;
  hoursUntilDowngrade:      number | null;
  wasDowngraded:            boolean;
  currentEngineMode:        string | null;
  spendOnlyMode:            boolean;
  gracePeriodHours:         number;
}

export default function PostbackSafetyBanner() {
  const [status, setStatus] = useState<PostbackStatus | null>(null);
  const [dismissed, setDismissed] = useState<"grace" | "downgrade" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/postback/status")
      .then(r => (r.ok ? r.json() : null))
      .then((d: PostbackStatus | null) => { if (!cancelled && d) setStatus(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Rien à afficher dans ces cas :
  //  - pas encore chargé
  //  - spend-only mode : le user a explicitement choisi de kill par budget, pas besoin de postback
  //  - déjà un postback reçu et pas de downgrade récent
  if (!status) return null;
  if (status.spendOnlyMode) return null;

  const showDowngrade = status.wasDowngraded && dismissed !== "downgrade";
  const showGrace     = !status.wasDowngraded && status.inGracePeriod && dismissed !== "grace";

  if (!showDowngrade && !showGrace) return null;

  // ── Bannière rouge : downgrade déjà fait ──────────────────────────────────
  if (showDowngrade) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(248,113,113,0.042)",
            border: "1px solid rgba(248,113,113,0.18)",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 12,
          }}
        >
          <ShieldAlert size={18} color="#f87171" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
              textTransform: "uppercase" as const, color: "#f87171", marginBottom: 3,
            }}>
              Engine basculé en Recommend
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.4 }}>
              Aucun postback reçu après {status.gracePeriodHours}h. On a mis ton robot en mode Recommend pour éviter de tuer des campagnes rentables à tort. Configure ton postback pour réactiver Automatic.
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            style={{
              padding: "7px 14px", borderRadius: 9, flexShrink: 0,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              background: "rgba(248,113,113,0.14)",
              border: "1px solid rgba(248,113,113,0.32)",
              color: "#f87171",
              textDecoration: "none",
            }}
          >
            Configurer
          </Link>
          <button
            onClick={() => setDismissed("downgrade")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center",
              opacity: 0.32, flexShrink: 0,
            }}
            aria-label="Fermer"
          >
            <X size={13} color="#f87171" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Bannière ambre : grace period active ──────────────────────────────────
  const hoursLeft = status.hoursUntilDowngrade ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(245,184,81,0.032)",
          border: "1px solid rgba(245,184,81,0.20)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <AlertTriangle size={18} color="#f5b851" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
            textTransform: "uppercase" as const, color: "#f5b851", marginBottom: 3,
          }}>
            Configure ton postback
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.4 }}>
            On n&apos;a encore reçu aucune vente. L&apos;engine ne peut pas voir ton ROI sans postback —
            {hoursLeft > 0
              ? ` il reste environ ${hoursLeft}h avant qu'il passe automatiquement en mode Recommend par sécurité.`
              : " il va bientôt passer en mode Recommend par sécurité."}
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          style={{
            padding: "7px 14px", borderRadius: 9, flexShrink: 0,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            background: "rgba(245,184,81,0.12)",
            border: "1px solid rgba(245,184,81,0.32)",
            color: "#f5b851",
            textDecoration: "none",
          }}
        >
          Configurer
        </Link>
        <button
          onClick={() => setDismissed("grace")}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, display: "flex", alignItems: "center",
            opacity: 0.32, flexShrink: 0,
          }}
          aria-label="Fermer"
        >
          <X size={13} color="#f5b851" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
