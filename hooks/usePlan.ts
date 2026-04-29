"use client";

/**
 * hooks/usePlan.ts
 *
 * Hook React qui lit le plan de l'utilisateur depuis /api/me
 * et expose des helpers pour vérifier les droits d'accès.
 *
 * Usage :
 *   const { planId, canUseAutomatic, canUseScale, scanIntervalMinutes } = usePlan();
 */

import { useState, useEffect } from "react";
import { PlanId, PLANS, normalizePlanId, hasAccess } from "@/lib/plans";

interface PlanState {
  planId: PlanId;
  plan: (typeof PLANS)[PlanId];

  // ── Campagnes & réseaux ──────────────────────────────────────────────────────
  campaignLimit: number;
  networkConnectionLimit: number | null;
  vaultAssetLimit: number | null;

  // ── Decision Engine ──────────────────────────────────────────────────────────
  canUseAutomatic: boolean;
  canUseScale: boolean;
  canUseKillSwitch: boolean;
  scanIntervalMinutes: number;

  // ── Data & Analytics ─────────────────────────────────────────────────────────
  canViewAnalytics: boolean;
  canUseDrillDown: boolean;
  canExportCsv: boolean;
  dataRetentionDays: number | null;

  // ── Postbacks ────────────────────────────────────────────────────────────────
  postbacksPerDay: number | null;

  // ── Communication ────────────────────────────────────────────────────────────
  canReceiveBriefing: boolean;

  // ── Helpers ──────────────────────────────────────────────────────────────────
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

    campaignLimit:          plan.campaignLimit,
    networkConnectionLimit: plan.networkConnectionLimit,
    vaultAssetLimit:        plan.vaultAssetLimit,

    canUseAutomatic:     plan.canUseAutomatic,
    canUseScale:         plan.canUseScale,
    canUseKillSwitch:    plan.canUseKillSwitch,
    scanIntervalMinutes: plan.scanIntervalMinutes,

    canViewAnalytics:  plan.canViewAnalytics,
    canUseDrillDown:   plan.canUseDrillDown,
    canExportCsv:      plan.canExportCsv,
    dataRetentionDays: plan.dataRetentionDays,

    postbacksPerDay: plan.postbacksPerDay,

    canReceiveBriefing: plan.canReceiveBriefing,

    hasAccess: (required: PlanId) => hasAccess(planId, required),
    loading,
  };
}
