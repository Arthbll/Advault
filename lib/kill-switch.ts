/**
 * Kill-Switch Engine
 *
 * Pour chaque campagne ACTIVE d'un user, compare les stats fraîches ExoClick
 * (24h glissantes) aux seuils configurés :
 *   - ROI < roiThreshold  → pause + log KILL_SWITCH_TRIGGERED
 *   - Spend > maxSpendPerCampaign → pause + log KILL_SWITCH_TRIGGERED
 *
 * Note sur le revenu : ExoClick est un réseau publicitaire (spend seulement).
 * Le revenu vient du tracker (Voluum, BeMob…) via postbacks.
 * Ici on utilise le revenue stocké en base lors de la dernière sync —
 * suffisant pour le kill-switch puisqu'on compare le ROI cumulé du jour.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter }    from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import { Network, CampaignStatus, LogType } from "@prisma/client";

export interface KillSwitchResult {
  userId:  string;
  checked: number;   // nombre de campagnes évaluées
  killed:  number;   // nombre de campagnes mises en pause
  skipped: number;   // kill-switch désactivé ou aucun compte
  errors:  string[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Helper: évalue et (si besoin) pause une campagne pour un réseau donné ────
async function evaluateCampaigns(
  userId:              string,
  accountId:           string,
  network:             Network,
  networkLabel:        string,
  statsMap:            Record<string, { spent: number; revenue?: number }>,
  roiThreshold:        number,
  maxSpendPerCampaign: number | null,
  pauseFn:             (externalId: string) => Promise<void>,
  result:              KillSwitchResult,
  spendOnlyMode:       boolean = false,
): Promise<void> {
  const activeCampaigns = await prisma.campaign.findMany({
    where: {
      userId,
      accountId,
      network,
      status: CampaignStatus.ACTIVE,
      // Pas de filtre dateFrom — on veut toutes les campagnes actives,
      // peu importe la date de sync. Les stats fraîches viennent du statsMap.
    },
    orderBy: { syncedAt: "desc" },
  });

  const seen = new Set<string>();
  const campaigns = activeCampaigns.filter(c => {
    if (seen.has(c.externalId)) return false;
    seen.add(c.externalId);
    return true;
  });

  // Pré-calcul du spend cumulé par externalId depuis la DB
  // (somme de toutes les lignes par jour pour chaque campagne)
  const externalIds = campaigns.map(c => c.externalId);
  const cumulative = await prisma.$queryRaw<{ externalId: string; totalSpend: number; totalRevenue: number }[]>`
    SELECT "externalId",
           SUM(spend)   AS "totalSpend",
           SUM(revenue) AS "totalRevenue"
    FROM "Campaign"
    WHERE "userId"    = ${userId}
      AND "accountId" = ${accountId}
      AND "externalId" = ANY(${externalIds})
    GROUP BY "externalId"
  `;
  const cumMap: Record<string, { totalSpend: number; totalRevenue: number }> = {};
  for (const row of cumulative) {
    cumMap[row.externalId] = { totalSpend: Number(row.totalSpend), totalRevenue: Number(row.totalRevenue) };
  }

  for (const campaign of campaigns) {
    result.checked++;
    const stat = statsMap[campaign.externalId];
    const cum  = cumMap[campaign.externalId];

    // Priorité : stats fraîches du réseau pour aujourd'hui (si spend > 0)
    // Sinon : spend cumulé depuis la DB (toutes les journées connues)
    // Cela permet de killer même si la campagne n'a pas d'activité aujourd'hui
    // mais a déjà dépassé les seuils sur ses journées précédentes.
    const freshSpend   = (stat?.spent   ?? 0) > 0 ? stat!.spent   : (cum?.totalSpend   ?? 0);
    const freshRevenue = (stat?.revenue ?? 0) > 0 ? stat!.revenue! : (cum?.totalRevenue ?? 0);
    const profit       = freshRevenue - freshSpend;
    const roi          = freshSpend > 0 ? (profit / freshSpend) * 100 : 0;

    // En mode spend-only : on ignore complètement le ROI (utile sans tracker)
    const roiTrigger    = !spendOnlyMode && freshSpend > 0 && roi < roiThreshold;
    const budgetTrigger = maxSpendPerCampaign != null && freshSpend > maxSpendPerCampaign;

    if (!roiTrigger && !budgetTrigger) continue;

    try {
      await pauseFn(campaign.externalId);
    } catch (err) {
      result.errors.push(`pauseCampaign(${networkLabel}/${campaign.externalId}): ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    await prisma.campaign.updateMany({
      where: { userId, accountId, externalId: campaign.externalId },
      data:  { status: CampaignStatus.KILLED },
    });

    const reason = roiTrigger
      ? `ROI ${roi.toFixed(1)}% < seuil ${roiThreshold}%`
      : `Spend ${freshSpend.toFixed(2)}€ > max ${maxSpendPerCampaign}€`;

    await prisma.log.create({
      data: {
        userId,
        campaignId: campaign.id,
        type:       LogType.KILL_SWITCH_TRIGGERED,
        message:    `Kill-Switch déclenché — "${campaign.name}" pausée. ${reason}`,
        metadata: {
          network:      networkLabel,
          externalId:   campaign.externalId,
          campaignName: campaign.name,
          spend:        freshSpend,
          revenue:      freshRevenue,
          roi:          parseFloat(roi.toFixed(2)),
          roiThreshold,
          maxSpendPerCampaign,
          trigger:      roiTrigger ? "roi" : "budget",
          reason,
        },
      },
    });

    result.killed++;
  }
}

// ─── Moteur pour un seul utilisateur (tous réseaux) ──────────────────────────
export async function runKillSwitchForUser(userId: string): Promise<KillSwitchResult> {
  const result: KillSwitchResult = { userId, checked: 0, killed: 0, skipped: 0, errors: [] };

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.killSwitchEnabled) { result.skipped = 1; return result; }

  const { roiThreshold, maxSpendPerCampaign } = settings;
  // spendOnlyMode : nouveau champ — fallback false si colonne pas encore migrée
  const spendOnlyMode = (settings as unknown as Record<string, unknown>).spendOnlyMode === true;

  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
  });

  if (accounts.length === 0) { result.skipped = 1; return result; }

  const today = todayStr();

  for (const account of accounts) {
    let apiKey: string;
    try {
      apiKey = decrypt(account.apiKeyEnc);
    } catch (err) {
      result.errors.push(`decrypt(${account.id}): ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // ── ExoClick ───────────────────────────────────────────────────────────────
    if (account.network === Network.EXOCLICK) {
      const adapter = new ExoClickAdapter(apiKey);
      let freshStats: Awaited<ReturnType<typeof adapter.getStats>>;
      try {
        freshStats = await adapter.getStats(today, today);
      } catch (err) {
        result.errors.push(`getStats ExoClick: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const statsMap: Record<string, { spent: number; revenue?: number }> = {};
      for (const s of freshStats) statsMap[String(s.campaignId)] = { spent: s.spent, revenue: (s as unknown as Record<string, unknown>).revenue as number | undefined };
      await evaluateCampaigns(userId, account.id, Network.EXOCLICK, "EXOCLICK", statsMap, roiThreshold, maxSpendPerCampaign,
        (id) => adapter.pauseCampaign(id), result, spendOnlyMode);
    }

    // ── TrafficStars ───────────────────────────────────────────────────────────
    else if (account.network === Network.TRAFFICSTARS) {
      const adapter = new TrafficStarsAdapter(apiKey);
      let freshStats: Awaited<ReturnType<typeof adapter.getStats>>;
      try {
        freshStats = await adapter.getStats(today, today);
      } catch (err) {
        result.errors.push(`getStats TrafficStars: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const statsMap: Record<string, { spent: number }> = {};
      for (const s of freshStats) statsMap[String(s.campaignId)] = { spent: s.spent };
      await evaluateCampaigns(userId, account.id, Network.TRAFFICSTARS, "TRAFFICSTARS", statsMap, roiThreshold, maxSpendPerCampaign,
        (id) => adapter.pauseCampaign(id), result, spendOnlyMode);
    }

    // ── TrafficJunky ───────────────────────────────────────────────────────────
    else if (account.network === Network.TRAFFICJUNKY) {
      const adapter = new TrafficJunkyAdapter(apiKey);
      let freshStats: Awaited<ReturnType<typeof adapter.getStats>>;
      try {
        freshStats = await adapter.getStats(today, today);
      } catch (err) {
        result.errors.push(`getStats TrafficJunky: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const statsMap: Record<string, { spent: number }> = {};
      for (const s of freshStats) statsMap[String(s.campaignId)] = { spent: s.spent };
      await evaluateCampaigns(userId, account.id, Network.TRAFFICJUNKY, "TRAFFICJUNKY", statsMap, roiThreshold, maxSpendPerCampaign,
        (id) => adapter.pauseCampaign(id), result, spendOnlyMode);
    }
  }

  return result;
}

// ─── Moteur global : tourne pour TOUS les users avec Kill-Switch activé ───────
// Appelé par le cron Vercel (GET /api/kill-switch/run avec CRON_SECRET)
export async function runKillSwitchGlobal(): Promise<{
  users:   number;
  checked: number;
  killed:  number;
  errors:  string[];
}> {
  // Trouve tous les users avec killSwitchEnabled = true
  const allSettings = await prisma.userSettings.findMany({
    where: { killSwitchEnabled: true },
    select: { userId: true },
  });

  let totalChecked = 0;
  let totalKilled  = 0;
  const allErrors: string[] = [];

  for (const { userId } of allSettings) {
    try {
      const r = await runKillSwitchForUser(userId);
      totalChecked += r.checked;
      totalKilled  += r.killed;
      allErrors.push(...r.errors);
    } catch (err) {
      allErrors.push(`user(${userId}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    users:   allSettings.length,
    checked: totalChecked,
    killed:  totalKilled,
    errors:  allErrors,
  };
}
