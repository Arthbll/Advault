"use client";

/**
 * hooks/usePlan.ts
 *
 * Hook React qui lit le plan de l'utilisateur depuis /api/me
 * et expose des helpers pour vérifier les droits d'accès.
 *
 * Usage :
 *   const { planId, plan, canUseAutomatic, atCampaignLimit } = usePlan();
 */

import { useState, useEffect } from "react";
import { PlanId, PLANS, normalizePlanId, hasAccess } from "@/lib/plans";

interface PlanState {
  planId: PlanId;
  plan: (typeof PLANS)[PlanId];
  /** L'utilisateur peut activer le mode automatique */
  canUseAutomatic: boolean;
  /** L'utilisateur peut voir la page Analytics */
  canViewAnalytics: boolean;
  /** L'utilisateur peut exporter en CSV */
  canExportCsv: boolean;
  /** L'utilisateur a accès aux filtres drill-down */
  canUseDrillDown: boolean;
  /** Limite de campagnes (Infinity pour Dominion) */
  campaignLimit: number;
  /** Vérifie si le plan donne accès à un plan requis */
  hasAccess: (required: PlanId) => boolean;
  /** Chargement en cours */
  loading: boolean;
}

export function usePlan(): PlanState {
  const [planId, setPlanId] = useState<PlanId>("observer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.ok ? r.json() : null)
      .then((d: { planId?: string } | null) => {
        if (d?.planId) setPlanId(normalizePlanId(d.planId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const plan = PLANS[planId];

  return {
    planId,
    plan,
    canUseAutomatic:  plan.canUseAutomatic,
    canViewAnalytics: plan.canViewAnalytics,
    canExportCsv:     plan.canExportCsv,
    canUseDrillDown:  plan.canUseDrillDown,
    campaignLimit:    plan.campaignLimit,
    hasAccess:        (required: PlanId) => hasAccess(planId, required),
    loading,
  };
}
