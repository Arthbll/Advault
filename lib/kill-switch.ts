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
import * as PropellerAds       from "@/lib/adapters/propellerads";
import * as Adsterra           from "@/lib/adapters/adsterra";
import { Network, CampaignStatus, LogType } from "@prisma/client";

export interface KillSwitchResult {
  userId:  string;
  checked: number;   // nombre de campagnes évaluées
  killed:  number;   // nombre de campagnes mises en pause
  scaled:  number;   // nombre de campagnes scalées
  skipped: number;   // kill-switch désactivé ou aucun compte
  errors:  string[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Shape de la DecisionRule passée au moteur ────────────────────────────────
interface EngineRule {
  scaleRoi:       number;   // ROI % au-dessus duquel on scale (défaut 30)
  scaleIncrement: number;   // % d'augmentation du bid (défaut 10)
  minSpend:       number;   // € minimum avant toute décision (défaut 20)
  killCooldownH:  number;   // heures entre deux kills sur la même campagne (défaut 6)
  scaleCooldownH: number;   // heures entre deux scales sur la même campagne (défaut 6)
  engineMode:     string;   // "automatic" | "recommendation"
}

// ─── Helper: évalue et (si besoin) pause / scale une campagne ─────────────────
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
  scaleFn?:            (externalId: string, multiplier: number) => Promise<{ oldBid: number; newBid: number }>,
  engineRule?:         EngineRule | null,
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

    // isAutomatic est utilisé dans les deux branches (scale et kill) — déclaré ici au niveau du loop
    const isAutomatic = (engineRule?.engineMode ?? "automatic") === "automatic";

    // ── Pas de kill → Watch zone ou Scale zone ──────────────────────────────
    if (!roiTrigger && !budgetTrigger) {

      // ── Watch zone : ROI négatif mais au-dessus du seuil de kill ────────
      // Loggué une seule fois par heure par campagne pour éviter le spam
      const inWatchZone = !spendOnlyMode && freshSpend > 0 && roi < 0 && roi > roiThreshold;
      if (inWatchZone) {
        const recentWatch = await prisma.log.findFirst({
          where: {
            userId,
            type:       "DECISION_WATCH" as LogType,
            campaignId: campaign.id,
            createdAt:  { gte: new Date(Date.now() - 60 * 60_000) },
          },
        });
        if (!recentWatch) {
          await prisma.log.create({
            data: {
              userId,
              campaignId: campaign.id,
              type:       "DECISION_WATCH" as LogType,
              message:    `Decision Engine — "${campaign.name}" en zone de surveillance. ROI ${roi.toFixed(1)}%`,
              metadata: {
                network:      networkLabel,
                externalId:   campaign.externalId,
                campaignName: campaign.name,
                spend:        freshSpend,
                revenue:      freshRevenue,
                roi:          parseFloat(roi.toFixed(2)),
                roiThreshold,
                trigger:      "watch",
                reason:       "review zone entered",
              },
            },
          });
        }
      }

      // ── Scale zone : ROI au-dessus du seuil de scale ─────────────────────
      // On scale le bid une seule fois par cooldown par campagne
      const scaleRoi       = engineRule?.scaleRoi       ?? 30;
      const scaleIncrement = engineRule?.scaleIncrement ?? 10;
      const minSpend       = engineRule?.minSpend       ?? 20;
      const scaleCooldownH = engineRule?.scaleCooldownH ?? 6;

      const inScaleZone = !spendOnlyMode && freshSpend >= minSpend && roi >= scaleRoi;

      if (inScaleZone) {
        // Cooldown : pas de DECISION_SCALE sur cette campagne dans les X dernières heures
        const recentScale = await prisma.log.findFirst({
          where: {
            userId,
            type:       "DECISION_SCALE" as LogType,
            campaignId: campaign.id,
            createdAt:  { gte: new Date(Date.now() - scaleCooldownH * 60 * 60_000) },
          },
        });

        if (!recentScale) {
          const multiplier = 1 + scaleIncrement / 100;
          let oldBid = 0;
          let newBid = 0;

          // En mode automatique : appel API réel pour monter le bid
          if (isAutomatic && scaleFn) {
            try {
              ({ oldBid, newBid } = await scaleFn(campaign.externalId, multiplier));
            } catch (err) {
              result.errors.push(`scaleBid(${networkLabel}/${campaign.externalId}): ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            // Mode recommendation : calcul estimé sans appel API
            oldBid = freshSpend;
            newBid = parseFloat((freshSpend * multiplier).toFixed(2));
          }

          const injected = parseFloat((newBid - oldBid).toFixed(2));

          await prisma.log.create({
            data: {
              userId,
              campaignId: campaign.id,
              type:       "DECISION_SCALE" as LogType,
              message:    `Decision Engine — "${campaign.name}" scalée. ROI ${roi.toFixed(1)}% › bid +${scaleIncrement}%`,
              metadata: {
                network:      networkLabel,
                externalId:   campaign.externalId,
                campaignName: campaign.name,
                spend:        freshSpend,
                revenue:      freshRevenue,
                roi:          parseFloat(roi.toFixed(2)),
                scaleRoi,
                scalePct:     scaleIncrement,
                oldBid:       parseFloat(oldBid.toFixed(2)),
                newBid:       parseFloat(newBid.toFixed(2)),
                injected,
                trigger:      "scale",
                mode:         isAutomatic ? "automatic" : "recommendation",
                reason:       `ROI ${roi.toFixed(1)}% › seuil ${scaleRoi}%`,
              },
            },
          });

          result.scaled++;
        }
      }

      continue;
    }

    const reason = roiTrigger
      ? `ROI ${roi.toFixed(1)}% < seuil ${roiThreshold}%`
      : `Spend ${freshSpend.toFixed(2)}€ > max ${maxSpendPerCampaign}€`;

    // ── Kill cooldown check ──────────────────────────────────────────────────
    // Ne pas re-killer une campagne si une action DECISION_KILL a déjà eu lieu
    // dans la fenêtre de cooldown configurable (défaut 6h).
    const killCooldownH = engineRule?.killCooldownH ?? 6;
    if (killCooldownH > 0) {
      const recentKill = await prisma.log.findFirst({
        where: {
          userId,
          type:       "DECISION_KILL" as LogType,
          campaignId: campaign.id,
          createdAt:  { gte: new Date(Date.now() - killCooldownH * 60 * 60_000) },
        },
      });
      if (recentKill) {
        // Cooldown actif — on ne re-kill pas, on passe silencieusement
        continue;
      }
    }

    if (isAutomatic) {
      // Mode automatique : pause réelle de la campagne
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
    }
    // Mode recommendation : log uniquement, aucune action réelle exécutée

    await prisma.log.create({
      data: {
        userId,
        campaignId: campaign.id,
        type:       "DECISION_KILL" as LogType,
        message:    isAutomatic
          ? `Decision Engine — "${campaign.name}" stoppée. ${reason}`
          : `Decision Engine — "${campaign.name}" : pause suggérée. ${reason}`,
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
          mode:         isAutomatic ? "automatic" : "recommendation",
          reason,
        },
      },
    });

    result.killed++;
  }
}

// ─── Moteur pour un seul utilisateur (tous réseaux) ──────────────────────────
export async function runKillSwitchForUser(userId: string): Promise<KillSwitchResult> {
  const result: KillSwitchResult = { userId, checked: 0, killed: 0, scaled: 0, skipped: 0, errors: [] };

  const [settings, decisionRule] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.decisionRule.findUnique({
      where:  { userId },
      select: { scaleRoi: true, scaleIncrement: true, minSpend: true, killCooldownH: true, scaleCooldownH: true, engineMode: true },
    }).catch(() => null),
  ]);

  if (!settings?.killSwitchEnabled) { result.skipped = 1; return result; }

  const { roiThreshold, maxSpendPerCampaign } = settings;
  const spendOnlyMode = settings.spendOnlyMode ?? false;

  // Règles du Decision Engine (scale / kill / watch thresholds)
  const engineRule: EngineRule | null = decisionRule
    ? {
        scaleRoi:       decisionRule.scaleRoi,
        scaleIncrement: decisionRule.scaleIncrement,
        minSpend:       decisionRule.minSpend,
        killCooldownH:  decisionRule.killCooldownH,
        scaleCooldownH: decisionRule.scaleCooldownH,
        engineMode:     decisionRule.engineMode,
      }
    : null;

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
        (id) => adapter.pauseCampaign(id), result, spendOnlyMode,
        (id, mult) => adapter.scaleBid(id, mult), engineRule);
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
        (id) => adapter.pauseCampaign(id), result, spendOnlyMode,
        (id, mult) => adapter.scaleBid(id, mult), engineRule);
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
        (id) => adapter.pauseCampaign(id), result, spendOnlyMode,
        (id, mult) => adapter.scaleBid(id, mult), engineRule);
    }

    // ── PropellerAds ──────────────────────────────────────────────────────────
    else if (account.network === Network.PROPELLERADS) {
      let freshStats: Awaited<ReturnType<typeof PropellerAds.getCampaignStats>>;
      try {
        freshStats = await PropellerAds.getCampaignStats(apiKey, today, today);
      } catch (err) {
        result.errors.push(`getStats PropellerAds: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const statsMap: Record<string, { spent: number }> = {};
      for (const s of freshStats) statsMap[String(s.campaign_id)] = { spent: s.spent };
      await evaluateCampaigns(userId, account.id, Network.PROPELLERADS, "PROPELLERADS", statsMap, roiThreshold, maxSpendPerCampaign,
        (id) => PropellerAds.pauseCampaign(apiKey, id).then(r => { if (!r.ok) throw new Error(r.error); }),
        result, spendOnlyMode,
        async () => ({ oldBid: 0, newBid: 0 }), // no bid scale via PropellerAds API V1
        engineRule);
    }

    // ── Adsterra ──────────────────────────────────────────────────────────────
    else if (account.network === Network.ADSTERRA) {
      let freshStats: Awaited<ReturnType<typeof Adsterra.getCampaignStats>>;
      try {
        freshStats = await Adsterra.getCampaignStats(apiKey, today, today);
      } catch (err) {
        result.errors.push(`getStats Adsterra: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const statsMap: Record<string, { spent: number }> = {};
      for (const s of freshStats) statsMap[String(s.campaign_id)] = { spent: s.spent };
      await evaluateCampaigns(userId, account.id, Network.ADSTERRA, "ADSTERRA", statsMap, roiThreshold, maxSpendPerCampaign,
        (id) => Adsterra.pauseCampaign(apiKey, id).then(r => { if (!r.ok) throw new Error(r.error); }),
        result, spendOnlyMode,
        async () => ({ oldBid: 0, newBid: 0 }), // no bid scale via Adsterra API V1
        engineRule);
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
  scaled:  number;
  errors:  string[];
}> {
  // Trouve tous les users avec killSwitchEnabled = true
  const allSettings = await prisma.userSettings.findMany({
    where: { killSwitchEnabled: true },
    select: { userId: true },
  });

  let totalChecked = 0;
  let totalKilled  = 0;
  let totalScaled  = 0;
  const allErrors: string[] = [];

  for (const { userId } of allSettings) {
    try {
      const r = await runKillSwitchForUser(userId);
      totalChecked += r.checked;
      totalKilled  += r.killed;
      totalScaled  += r.scaled;
      allErrors.push(...r.errors);
    } catch (err) {
      allErrors.push(`user(${userId}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    users:   allSettings.length,
    checked: totalChecked,
    killed:  totalKilled,
    scaled:  totalScaled,
    errors:  allErrors,
  };
}
