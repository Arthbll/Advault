/**
 * lib/plans.ts
 *
 * Source de vérité unique pour les plans ProfitDash.
 * Importé côté serveur ET côté client — ne jamais y mettre de secrets.
 *
 * Plans :
 *   observer  → Free    — 2 campagnes max, mode recommendation uniquement, analytics verrouillé
 *   operator  → Operator — 20 campagnes max, mode recommendation uniquement, analytics basique
 *   dominion  → Dominion — illimité, mode automatique, analytics complet
 */

export const PLAN_IDS = ["observer", "operator", "dominion"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanConfig {
  /** Nom affiché dans l'UI */
  label: string;
  /** Nombre max de campagnes actives (Infinity = illimité) */
  campaignLimit: number;
  /** Peut activer le mode automatique (kill/scale réels) */
  canUseAutomatic: boolean;
  /** Peut accéder à la page Analytics */
  canViewAnalytics: boolean;
  /** Peut exporter les données en CSV */
  canExportCsv: boolean;
  /** Peut utiliser les filtres drill-down (réseau, geo) */
  canUseDrillDown: boolean;
  /** Plan supérieur requis pour débloquer */
  upgradeTo?: "operator" | "dominion";
  /** Label du bouton d'upgrade */
  upgradeLabel?: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  observer: {
    label: "Free",
    campaignLimit: 2,
    canUseAutomatic: false,
    canViewAnalytics: false,
    canExportCsv: false,
    canUseDrillDown: false,
    upgradeTo: "operator",
    upgradeLabel: "Upgrade to Operator",
  },
  operator: {
    label: "Operator",
    campaignLimit: 20,
    canUseAutomatic: false,
    canViewAnalytics: true,
    canExportCsv: false,
    canUseDrillDown: false,
    upgradeTo: "dominion",
    upgradeLabel: "Upgrade to Dominion",
  },
  dominion: {
    label: "Dominion",
    campaignLimit: Infinity,
    canUseAutomatic: true,
    canViewAnalytics: true,
    canExportCsv: true,
    canUseDrillDown: true,
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
