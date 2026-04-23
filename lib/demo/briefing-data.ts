/**
 * Construit le BriefingData du user démo à partir des données Prisma réelles
 * (ses campagnes démo, ses logs démo, ses conversions démo).
 *
 * Remplace les données hardcodées de getSampleBriefingData() — une fois le
 * workspace démo seed + simulator, Arthur reçoit un mail basé sur des vraies
 * données qui bougent d'un jour à l'autre.
 */

import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL, DEMO_USER_FIRSTNAME } from "./config";
import type {
  BriefingData,
  BriefingEvent,
  BriefingCampaignAttention,
} from "@/lib/email/daily-briefing";

// 24h glissantes (pour les logs)
function last24h() {
  const to   = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from, to };
}

// Journée courante — pour filtrer les snapshots Campaign du jour.
// Campaign @@unique([accountId, externalId, dateFrom, dateTo]) : chaque jour
// est une ligne. Sans ce filtre, le briefing cumulerait les snapshots passés.
function todayRange() {
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dateTo   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { dateFrom, dateTo };
}

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export async function buildDemoBriefingData(opts?: { dashboardUrl?: string }): Promise<BriefingData | null> {
  const user = await prisma.user.findUnique({
    where:   { email: DEMO_USER_EMAIL },
    include: { settings: true },
  });
  if (!user) return null;

  const { from, to } = last24h();
  const { dateFrom: todayFrom, dateTo: todayTo } = todayRange();
  const todaySnapshotWhere = {
    userId:   user.id,
    dateFrom: { gte: todayFrom },
    dateTo:   { lte: todayTo },
  };

  // ── Logs des dernières 24h (kills, scales, flags) ───────────────────────────
  const recentLogs = await prisma.log.findMany({
    where: {
      userId:    user.id,
      createdAt: { gte: from, lte: to },
      type:      { in: ["DECISION_KILL", "DECISION_SCALE", "DECISION_WATCH"] },
    },
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take:    20,
  });

  const killCount  = recentLogs.filter(l => l.type === "DECISION_KILL").length;
  const scaleCount = recentLogs.filter(l => l.type === "DECISION_SCALE").length;
  const flagCount  = recentLogs.filter(l => l.type === "DECISION_WATCH").length;

  const events: BriefingEvent[] = [];
  if (killCount > 0) {
    const killed = recentLogs.filter(l => l.type === "DECISION_KILL");
    events.push({
      kind:   "kill",
      title:  `${killCount} campagne${killCount > 1 ? "s" : ""} tuée${killCount > 1 ? "s" : ""} (kill)`,
      detail: killed.slice(0, 2).map(l => l.campaign?.name ?? "—").join(", "),
    });
  }
  if (scaleCount > 0) {
    const scaled = recentLogs.filter(l => l.type === "DECISION_SCALE");
    events.push({
      kind:   "scale",
      title:  `${scaleCount} campagne${scaleCount > 1 ? "s" : ""} scalée${scaleCount > 1 ? "s" : ""} (scale)`,
      detail: scaled.slice(0, 2).map(l => l.campaign?.name ?? "—").join(", "),
    });
  }
  if (flagCount > 0) {
    events.push({
      kind:   "flag",
      title:  `${flagCount} flag${flagCount > 1 ? "s" : ""} watching`,
      detail: "ROI en dégradation — à surveiller aujourd'hui",
    });
  }

  // ── Répartition portfolio (snapshots du jour uniquement) ───────────────────
  const [scalingCount, watchingCount, needsActionCount] = await Promise.all([
    prisma.campaign.count({ where: { ...todaySnapshotWhere, status: "ACTIVE" } }),
    prisma.campaign.count({ where: { ...todaySnapshotWhere, status: "WATCH" } }),
    prisma.campaign.count({ where: { ...todaySnapshotWhere, status: { in: ["PAUSED", "KILLED"] } } }),
  ]);

  // ── Campagnes qui demandent attention aujourd'hui ──────────────────────────
  const watchCampaigns = await prisma.campaign.findMany({
    where:   { ...todaySnapshotWhere, status: "WATCH" },
    orderBy: { syncedAt: "desc" },
    take:    3,
  });

  const attention: BriefingCampaignAttention[] = watchCampaigns.map(c => {
    const spend   = Number(c.spend);
    const revenue = Number(c.revenue);
    const roi     = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
    return {
      name:   c.name,
      reason: roi < -10
        ? `ROI ${roi.toFixed(1)}% — proche du seuil de kill`
        : `Performance en zone watching — ROI ${roi.toFixed(1)}%`,
      roiPct: Math.round(roi * 10) / 10,
      spend:  Math.round(spend * 100) / 100,
    };
  });

  // ── Top creative — on prend la campagne ACTIVE avec le meilleur ROI ─────────
  const topCampaigns = await prisma.campaign.findMany({
    where: { ...todaySnapshotWhere, status: "ACTIVE" },
  });
  const topC = topCampaigns
    .map(c => {
      const spend   = Number(c.spend);
      const revenue = Number(c.revenue);
      const roi     = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
      return { c, roi };
    })
    .sort((a, b) => b.roi - a.roi)[0];

  const topCreative = topC && topC.roi > 0 ? {
    fileName:     `${topC.c.externalId}.mp4`,
    campaignName: topC.c.name,
    impressions:  topC.c.impressions,
    conversions:  topC.c.conversions,
    roiPct:       Math.round(topC.roi * 10) / 10,
  } : null;

  // ── Perf global (portfolio total, snapshots du jour) ──────────────────────
  const totals = await prisma.campaign.aggregate({
    where: todaySnapshotWhere,
    _sum:  { spend: true, revenue: true },
  });
  const totalSpend   = Number(totals._sum.spend ?? 0);
  const totalRevenue = Number(totals._sum.revenue ?? 0);
  const totalRoi     = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

  // Simulation des deltas vs J-1 (pour le démo — dans le vrai code, on
  // comparerait un snapshot J-2 vs J-1)
  const perf = {
    spend:           Math.round(totalSpend * 100) / 100,
    spendDelta:      +(totalSpend * 0.08).toFixed(2),
    spendDeltaPct:   8,
    revenue:         Math.round(totalRevenue * 100) / 100,
    revenueDelta:    +(totalRevenue * 0.12).toFixed(2),
    revenueDeltaPct: 12,
    roiPct:          Math.round(totalRoi * 10) / 10,
    roiDeltaPts:     3.4,
  };

  const firstName = user.email === DEMO_USER_EMAIL ? DEMO_USER_FIRSTNAME : "là";

  return {
    userFirstName: firstName,
    dateStr:       frDate(new Date()),
    timezone:      user.settings?.timezone ?? "Europe/Paris",
    events,
    portfolio: {
      scaling:     scalingCount,
      watching:    watchingCount,
      needsAction: needsActionCount,
    },
    attention,
    topCreative,
    perf,
    dashboardUrl: opts?.dashboardUrl
      ?? process.env.NEXT_PUBLIC_SITE_URL
      ?? "https://advault-project.vercel.app",
  };
}
