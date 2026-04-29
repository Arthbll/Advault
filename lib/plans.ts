/**
 * lib/plans.ts
 *
 * Source de vérité unique pour les plans ProfitDash.
 * Importé côté serveur ET côté client — ne jamais y mettre de secrets.
 *
 * Plans :
 *   observer  → Free       — 3 campagnes, 1 réseau, reco only, 7j historique
 *   operator  → Operator   — 50 campagnes, tous réseaux, mode auto, 10min scan
 *   dominion  → Dominion   — illimité, mode auto, 1min scan, export CSV, support prio
 *   agency    → Agence     — tarif custom (géré hors app)
 */

export const PLAN_IDS = ["observer", "operator", "dominion"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanConfig {
  /** Nom affiché dans l'UI */
  label: string;

  // ── Limites campagnes & réseaux ──────────────────────────────────────────────
  /** Nombre max de campagnes actives (Infinity = illimité) */
  campaignLimit: number;
  /** Nombre max de connexions réseau (null = illimité) */
  networkConnectionLimit: number | null;
  /** Nombre max d'assets dans le Vault (null = illimité) */
  vaultAssetLimit: number | null;

  // ── Decision Engine ──────────────────────────────────────────────────────────
  /** Peut activer le mode automatique (kill/scale réels sur les APIs réseaux) */
  canUseAutomatic: boolean;
  /** Peut configurer la règle Scale (augmenter les bids automatiquement) */
  canUseScale: boolean;
  /** Peut utiliser le Kill-Switch d'urgence (couper toutes les campagnes en 1 clic) */
  canUseKillSwitch: boolean;
  /** Fréquence de scan du Decision Engine en minutes */
  scanIntervalMinutes: number;

  // ── Data & Analytics ─────────────────────────────────────────────────────────
  /** Peut accéder à la page Analytics */
  canViewAnalytics: boolean;
  /** Peut utiliser les filtres drill-down (réseau, geo, device) */
  canUseDrillDown: boolean;
  /** Peut exporter les données en CSV */
  canExportCsv: boolean;
  /** Rétention des logs et transactions en jours (null = illimité) */
  dataRetentionDays: number | null;

  // ── Postbacks ────────────────────────────────────────────────────────────────
  /** Max postbacks reçus par jour (null = illimité) */
  postbacksPerDay: number | null;

  // ── Communication ────────────────────────────────────────────────────────────
  /** Reçoit le briefing email quotidien */
  canReceiveBriefing: boolean;

  // ── Upgrade ──────────────────────────────────────────────────────────────────
  /** Plan supérieur requis pour débloquer */
  upgradeTo?: "operator" | "dominion" | "agency";
  /** Label du bouton d'upgrade */
  upgradeLabel?: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  observer: {
    label: "Free",

    campaignLimit:          3,
    networkConnectionLimit: 1,
    vaultAssetLimit:        5,

    canUseAutomatic:    false,
    canUseScale:        false,   // Kill + Watch uniquement
    canUseKillSwitch:   false,
    scanIntervalMinutes: 30,

    canViewAnalytics: false,
    canUseDrillDown:  false,
    canExportCsv:     false,
    dataRetentionDays: 7,

    postbacksPerDay:      500,

    canReceiveBriefing: false,

    upgradeTo:    "operator",
    upgradeLabel: "Upgrade to Operator",
  },

  operator: {
    label: "Operator",

    campaignLimit:          50,
    networkConnectionLimit: null,   // tous les réseaux
    vaultAssetLimit:        null,   // illimité

    canUseAutomatic:    true,
    canUseScale:        true,
    canUseKillSwitch:   true,
    scanIntervalMinutes: 10,

    canViewAnalytics: true,
    canUseDrillDown:  true,
    canExportCsv:     false,
    dataRetentionDays: null,  // illimité

    postbacksPerDay: null,  // illimité

    canReceiveBriefing: true,

    upgradeTo:    "dominion",
    upgradeLabel: "Upgrade to Dominion",
  },

  dominion: {
    label: "Dominion",

    campaignLimit:          Infinity,
    networkConnectionLimit: null,
    vaultAssetLimit:        null,

    canUseAutomatic:    true,
    canUseScale:        true,
    canUseKillSwitch:   true,
    scanIntervalMinutes: 1,   // ← argument béton : réaction en 1 min vs 10 min

    canViewAnalytics: true,
    canUseDrillDown:  true,
    canExportCsv:     true,
    dataRetentionDays: null,

    postbacksPerDay: null,

    canReceiveBriefing: true,
  },
};

/**
 * Normalise n'importe quelle string en PlanId valide.
 * "Observer", "OPERATOR", "dominion" → tous retournent le bon PlanId.
 * Valeur inconnue → "observer" (plan le plus restrictif par sécurité).
 */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  const lower = (raw ?? "").toLowerCase().trim();
  if (PLAN_IDS.includes(lower as PlanId)) return lower as PlanId;
  return "observer";
}

/**
 * Retourne true si planId est >= requiredPlan dans la hiérarchie.
 * Ex: hasAccess("dominion", "operator") → true
 *     hasAccess("observer", "operator") → false
 */
export function hasAccess(planId: PlanId, requiredPlan: PlanId): boolean {
  return PLAN_IDS.indexOf(planId) >= PLAN_IDS.indexOf(requiredPlan);
}
