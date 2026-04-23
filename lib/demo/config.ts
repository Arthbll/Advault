/**
 * Configuration du mode démo.
 *
 * Règle N°1 — tout le code démo vit dans `lib/demo/`.
 * Rien dans les composants métier ne doit avoir un `if (isDemo)`.
 * Si demain on doit supprimer le démo, on supprime ce dossier et c'est tout.
 */

// ─── Identité du user démo ────────────────────────────────────────────────────

// Un seul user fictif. Toutes les données démo (campagnes, conversions, logs)
// sont scopées à ce userId via les contraintes Prisma (onDelete: Cascade).
// Supprimer ce user = propre et total, rien ne reste orphelin.
export const DEMO_USER_EMAIL = "demo@profitdash.internal";
export const DEMO_USER_FIRSTNAME = "Arthur";

// Domaine .internal → jamais routable publiquement (RFC 6762).
// Impossible qu'un vrai client signe avec ce mail par erreur.

// ─── Flag global ──────────────────────────────────────────────────────────────

// DEMO_MODE_ENABLED — env var côté Vercel.
// Si absente ou "false" → simulator off, routes démo répondent 503.
// Utile pour tuer proprement le démo sans supprimer le code (fenêtre de backout).
export function isDemoModeEnabled(): boolean {
  const raw = process.env.DEMO_MODE_ENABLED;
  if (!raw) return false;
  return raw.toLowerCase() === "true" || raw === "1";
}

// ─── Paramètres du seed ───────────────────────────────────────────────────────

// 15 campagnes Dating réalistes — mix de pays, formats, statuts.
// Volumes cohérents avec un buyer solo qui tourne 5-10k$/mois.
export const DEMO_CAMPAIGN_SPEC = {
  count: 15,
  // Distribution de statuts initiale — simule un workspace "vivant"
  distribution: {
    active: 9,     // campagnes qui tournent bien
    watching: 3,   // zone de surveillance — ROI entre -15% et 0%
    paused: 2,     // mises en pause manuellement
    killed: 1,     // déjà tuée par le Decision Engine
  },
  // Plages de stats — le simulator fera évoluer ces valeurs dans le temps
  spendRange:       [80, 450],      // $ par campagne
  roiRange:         [-35, 85],      // % — large éventail pour avoir du gagnant et du perdant
  impressionsRange: [15000, 250000],
  clicksRange:      [200, 8000],
  conversionsRange: [2, 45],
} as const;
