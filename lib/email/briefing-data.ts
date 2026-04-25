/**
 * Construit le BriefingData d'un utilisateur réel à partir de ses données
 * Prisma (ses campagnes, logs, conversions).
 *
 * Toutes les requêtes sont STRICTEMENT filtrées par userId.
 * Aucun mélange de données entre clients — règle SaaS N°1.
 */

import { prisma } from "@/lib/prisma";
import type {
  BriefingData,
  BriefingEvent,
  BriefingCampaignAttention,
} from "@/lib/email/daily-briefing";

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

/** Les 24 dernières heures glissantes */
function last24h() {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from, to };
}

/**
 * Plage du jour courant UTC.
 * Campaign @@unique([accountId, externalId, dateFrom, dateTo]) :
 * chaque snapshot quotidien est une ligne distincte.
 * Sans ce filtre, on cumulerait tous les snapshots passés.
 */
function todayRange() {
  const now = new Date();
  const dateFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  );
  const dateTo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)
  );
  return { dateFrom, dateTo };
}

/** Format date lisible en français */
function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── BUILDER PRINCIPAL ────────────────────────────────────────────────────────

export interface BuildBriefingParams {
  userId: string;
  firstName: string;
  timezone?: string;
  dashboardUrl?: string;
}

/**
 * Construit les données du briefing quotidien pour un utilisateur réel.
 *
 * Si l'utilisateur n'a aucune campagne, retourne un briefing "vide" cohérent
 * (pas d'erreur — juste un email qui dit "rien à signaler").
 */
export async function buildRealBriefingData(
  params: BuildBriefingParams
): Promise<BriefingData> {
  const {
    userId,
    firstName,
    timezone = "UTC",
    dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://profitdash.app",
  } = params;

  const { from, to } = last24h();
  const { dateFrom: todayFrom, dateTo: todayTo } = todayRange();

  // Filtre de base : snapshots du jour courant pour cet utilisateur
  const todaySnapshotWhere = {
    userId,
    dateFrom: { gte: todayFrom },
    dateTo: { lte: todayTo },
  } as const;

  // ── 1. Logs des 24 dernières heures (kills, scales, flags) ─────────────────
  const recentLogs = await prisma.log.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
      type: { in: ["DECISION_KILL", "DECISION_SCALE", "DECISION_WATCH"] },
    },
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const killCount = recentLogs.filter((l) => l.type === "DECISION_KILL").length;
  const scaleCount = recentLogs.filter(
    (l) => l.type === "DECISION_SCALE"
  ).length;
  const flagCount = recentLogs.filter(
    (l) => l.type === "DECISION_WATCH"
  ).length;

  const events: BriefingEvent[] = [];

  if (killCount > 0) {
    const killed = recentLogs.filter((l) => l.type === "DECISION_KILL");
    const names = killed
      .slice(0, 3)
      .map((l) => l.campaign?.name ?? "—")
      .join(", ");
    events.push({
      kind: "kill",
      title: `${killCount} campagne${killCount > 1 ? "s" : ""} arrêtée${killCount > 1 ? "s" : ""} automatiquement`,
      detail: `ROI sous le seuil — ${names}`,
    });
  }

  if (scaleCount > 0) {
    const scaled = recentLogs.filter((l) => l.type === "DECISION_SCALE");
    const names = scaled
      .slice(0, 3)
      .map((l) => l.campaign?.name ?? "—")
      .join(", ");
    events.push({
      kind: "scale",
      title: `${scaleCount} campagne${scaleCount > 1 ? "s" : ""} scalée${scaleCount > 1 ? "s" : ""} (+bid)`,
      detail: `ROI stable au-dessus du seuil — ${names}`,
    });
  }

  if (flagCount > 0) {
    const flagged = recentLogs.filter((l) => l.type === "DECISION_WATCH");
    const names = flagged
      .slice(0, 2)
      .map((l) => l.campaign?.name ?? "—")
      .join(", ");
    events.push({
      kind: "flag",
      title: `${flagCount} campagne${flagCount > 1 ? "s" : ""} en surveillance`,
      detail: `Performances en zone watching — ${names}`,
    });
  }

  if (events.length === 0) {
    // Aucune action du robot cette nuit — on le dit clairement
    events.push({
      kind: "flag",
      title: "Aucune action cette nuit",
      detail:
        "Toutes les campagnes sont dans la zone normale — le robot n'a pas eu à intervenir.",
    });
  }

  // ── 2. Répartition du portefeuille (snapshots du jour) ─────────────────────
  const [scalingCount, watchingCount, needsActionCount] = await Promise.all([
    prisma.campaign.count({
      where: { ...todaySnapshotWhere, status: "ACTIVE" },
    }),
    prisma.campaign.count({
      where: { ...todaySnapshotWhere, status: "WATCH" },
    }),
    prisma.campaign.count({
      where: {
        ...todaySnapshotWhere,
        status: { in: ["PAUSED", "KILLED"] },
      },
    }),
  ]);

  // ── 3. Campagnes à surveiller aujourd'hui ──────────────────────────────────
  const watchCampaigns = await prisma.campaign.findMany({
    where: { ...todaySnapshotWhere, status: "WATCH" },
    orderBy: { syncedAt: "desc" },
    take: 3,
  });

  const attention: BriefingCampaignAttention[] = watchCampaigns.map((c) => {
    const spend = Number(c.spend);
    const revenue = Number(c.revenue);
    const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
    return {
      name: c.name,
      reason:
        roi < -10
          ? `ROI ${roi.toFixed(1)}% — proche du seuil d'arrêt automatique`
          : `Zone watching — ROI ${roi.toFixed(1)}%`,
      roiPct: Math.round(roi * 10) / 10,
      spend: Math.round(spend * 100) / 100,
    };
  });

  // Si aucune campagne en watching, montrer les campagnes actives avec
  // le plus de dépenses (pour que l'email ne soit pas vide)
  if (attention.length === 0) {
    const topSpend = await prisma.campaign.findMany({
      where: { ...todaySnapshotWhere, status: "ACTIVE" },
      orderBy: { spend: "desc" },
      take: 2,
    });
    topSpend.forEach((c) => {
      const spend = Number(c.spend);
      const revenue = Number(c.revenue);
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
      attention.push({
        name: c.name,
        reason: `Campagne active — ROI ${roi.toFixed(1)}%`,
        roiPct: Math.round(roi * 10) / 10,
        spend: Math.round(spend * 100) / 100,
      });
    });
  }

  // ── 4. Top créatif — campagne ACTIVE avec le meilleur ROI ──────────────────
  const activeCampaigns = await prisma.campaign.findMany({
    where: { ...todaySnapshotWhere, status: "ACTIVE" },
  });

  const best = activeCampaigns
    .map((c) => {
      const spend = Number(c.spend);
      const revenue = Number(c.revenue);
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
      return { c, roi };
    })
    .sort((a, b) => b.roi - a.roi)[0];

  const topCreative =
    best && best.roi > 0 && best.c.impressions > 0
      ? {
          fileName: best.c.externalId,
          campaignName: best.c.name,
          impressions: best.c.impressions,
          conversions: best.c.conversions,
          roiPct: Math.round(best.roi * 10) / 10,
        }
      : null;

  // ── 5. Performance globale : hier vs avant-hier ────────────────────────────
  // "Hier" = le snapshot du jour courant (ou le plus récent disponible)
  // "Avant-hier" = snapshot du jour précédent
  const yesterdayFrom = new Date(todayFrom.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayTo = new Date(todayTo.getTime() - 24 * 60 * 60 * 1000);

  const [todayTotals, yesterdayTotals] = await Promise.all([
    prisma.campaign.aggregate({
      where: todaySnapshotWhere,
      _sum: { spend: true, revenue: true },
    }),
    prisma.campaign.aggregate({
      where: {
        userId,
        dateFrom: { gte: yesterdayFrom },
        dateTo: { lte: yesterdayTo },
      },
      _sum: { spend: true, revenue: true },
    }),
  ]);

  const todaySpend = Number(todayTotals._sum.spend ?? 0);
  const todayRevenue = Number(todayTotals._sum.revenue ?? 0);
  const prevSpend = Number(yesterdayTotals._sum.spend ?? 0);
  const prevRevenue = Number(yesterdayTotals._sum.revenue ?? 0);

  const todayRoi =
    todaySpend > 0 ? ((todayRevenue - todaySpend) / todaySpend) * 100 : 0;
  const prevRoi =
    prevSpend > 0 ? ((prevRevenue - prevSpend) / prevSpend) * 100 : 0;

  const spendDelta = Math.round((todaySpend - prevSpend) * 100) / 100;
  const spendDeltaPct =
    prevSpend > 0 ? Math.round(((todaySpend - prevSpend) / prevSpend) * 100) : 0;
  const revenueDelta = Math.round((todayRevenue - prevRevenue) * 100) / 100;
  const revenueDeltaPct =
    prevRevenue > 0
      ? Math.round(((todayRevenue - prevRevenue) / prevRevenue) * 100)
      : 0;
  const roiDeltaPts = Math.round((todayRoi - prevRoi) * 10) / 10;

  return {
    userFirstName: firstName,
    dateStr: frDate(new Date()),
    timezone,
    events,
    portfolio: {
      scaling: scalingCount,
      watching: watchingCount,
      needsAction: needsActionCount,
    },
    attention,
    topCreative,
    perf: {
      spend: Math.round(todaySpend * 100) / 100,
      spendDelta,
      spendDeltaPct,
      revenue: Math.round(todayRevenue * 100) / 100,
      revenueDelta,
      revenueDeltaPct,
      roiPct: Math.round(todayRoi * 10) / 10,
      roiDeltaPts,
    },
    dashboardUrl,
  };
}
