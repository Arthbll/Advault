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

// ─── Garde-fous postback (défense en profondeur) ──────────────────────────────
// Période de grâce pendant laquelle l'engine ne peut pas KILL par ROI un user
// qui n'a jamais reçu de postback. Laisse le temps au tracker d'être branché
// et aux premières ventes d'arriver avant que le moteur agisse.
// Passée cette durée, si toujours aucun postback en mode automatic → downgrade
// automatique vers mode recommendation pour protéger l'utilisateur.
const GRACE_PERIOD_HOURS = 48;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Shape de la DecisionRule passée au moteur ────────────────────────────────
interface EngineRule {
  scaleRoi:        number;   // ROI % au-dessus duquel on scale (défaut 30)
  scaleIncrement:  number;   // % d'augmentation du bid (défaut 10)
  minSpend:        number;   // € minimum avant toute décision (défaut 20)
  minConversions:  number;   // conversions minimum avant de scaler (défaut 3)
  killCooldownH:   number;   // heures entre deux kills sur la même campagne (défaut 6)
  scaleCooldownH:  number;   // heures entre deux scales sur la même campagne (défaut 6)
  killHoldMin:     number;   // minutes condition must hold before Kill fires (défaut 30)
  scaleHoldMin:    number;   // minutes condition must hold before Scale fires (défaut 60)
  maxKillsDay:     number;   // max Kill actions per day, 0 = illimité (défaut 5)
  maxScalesDay:    number;   // max Scale actions per day, 0 = illimité (défaut 2)
  engineMode:      string;   // "automatic" | "recommendation"
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
  inGracePeriod:       boolean = false,
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
    // excludeFromEngine : l'utilisateur a mis cette campagne en "Manuel uniquement"
    if (c.excludeFromEngine) return false;
    // automationPaused : pause temporaire de l'automation sur cette campagne
    if (c.automationPaused) return false;
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
      const scaleRoi        = engineRule?.scaleRoi        ?? 30;
      const scaleIncrement  = engineRule?.scaleIncrement  ?? 10;
      const minSpend        = engineRule?.minSpend        ?? 20;
      const minConversions  = engineRule?.minConversions  ?? 3;
      const scaleCooldownH  = engineRule?.scaleCooldownH  ?? 6;

      // IMPORTANT : pour le scale, on n'utilise QUE les stats fraîches de l'API du jour.
      // Si l'API ne retourne pas de spend aujourd'hui (stat absent ou spend=0),
      // on NE scale pas — évite de scaler sur des données historiques obsolètes.
      const hasFreshActivity = stat != null && (stat.spent ?? 0) > 0;

      // Nombre de conversions sur la campagne (depuis la DB — mis à jour à chaque sync)
      const campaignConversions = campaign.conversions ?? 0;

      const inScaleZone = !spendOnlyMode
        && hasFreshActivity
        && freshSpend >= minSpend
        && roi >= scaleRoi
        && campaignConversions >= minConversions;

      if (inScaleZone) {
        // Cooldown : pas de DECISION_SCALE (réel, pas holdPending) dans les X dernières heures.
        const recentScaleRows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Log"
          WHERE "userId"    = ${userId}
            AND "type"      = 'DECISION_SCALE'
            AND (metadata->>'holdPending') IS NULL
            AND "createdAt" >= ${new Date(Date.now() - scaleCooldownH * 60 * 60_000)}
            AND metadata->>'externalId' = ${campaign.externalId}
          LIMIT 1
        `;
        const recentScale = recentScaleRows.length > 0 ? recentScaleRows[0] : null;

        if (!recentScale) {
          // ── maxScalesDay : limite journalière ──────────────────────────────
          const maxScalesDay = engineRule?.maxScalesDay ?? 2;
          if (maxScalesDay > 0) {
            const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
            const scalesTodayRows = await prisma.$queryRaw<{ count: bigint }[]>`
              SELECT COUNT(*) AS count FROM "Log"
              WHERE "userId"    = ${userId}
                AND "type"      = 'DECISION_SCALE'
                AND (metadata->>'holdPending') IS NULL
                AND "createdAt" >= ${todayMidnight}
            `;
            if (Number(scalesTodayRows[0]?.count ?? 0) >= maxScalesDay) { continue; }
          }

          // ── scaleHoldMin : condition doit tenir X minutes avant de scaler ─
          const scaleHoldMin = engineRule?.scaleHoldMin ?? 0;
          if (scaleHoldMin > 0) {
            const holdRows = await prisma.$queryRaw<{ id: string; createdAt: Date }[]>`
              SELECT id, "createdAt" FROM "Log"
              WHERE "userId"    = ${userId}
                AND "type"      = 'DECISION_SCALE'
                AND metadata->>'holdPending' = 'true'
                AND metadata->>'externalId'  = ${campaign.externalId}
              ORDER BY "createdAt" DESC
              LIMIT 1
            `;
            if (holdRows.length === 0) {
              await prisma.log.create({
                data: {
                  userId,
                  campaignId: campaign.id,
                  type:       "DECISION_SCALE" as LogType,
                  message:    `[HOLD] Decision Engine — "${campaign.name}" : scale en attente (${scaleHoldMin}min). ROI ${roi.toFixed(1)}%`,
                  metadata: {
                    network:     networkLabel,
                    externalId:  campaign.externalId,
                    campaignName: campaign.name,
                    spend:       freshSpend,
                    roi:         parseFloat(roi.toFixed(2)),
                    holdPending: true,
                    holdMinutes: scaleHoldMin,
                    holdUntil:   new Date(Date.now() + scaleHoldMin * 60_000).toISOString(),
                  },
                },
              });
              continue;
            }
            const ageMin = (Date.now() - new Date(holdRows[0].createdAt).getTime()) / 60_000;
            if (ageMin < scaleHoldMin) { continue; }
          }
          const multiplier = 1 + scaleIncrement / 100;
          let oldBid = 0;
          let newBid = 0;

          // En mode automatique : appel API réel pour monter le bid CPM/CPC
          if (isAutomatic && scaleFn) {
            try {
              ({ oldBid, newBid } = await scaleFn(campaign.externalId, multiplier));
            } catch (err) {
              // L'appel API a échoué — on logue l'erreur et on skip complètement.
              // IMPORTANT : on ne crée PAS de log DECISION_SCALE si l'action n'a pas eu lieu.
              result.errors.push(`scaleBid(${networkLabel}/${campaign.externalId}): ${err instanceof Error ? err.message : String(err)}`);
              continue;
            }
          } else {
            // Mode recommendation : estimation sans appel API
            oldBid = freshSpend;
            newBid = parseFloat((freshSpend * multiplier).toFixed(2));
          }

          const injected = parseFloat((newBid - oldBid).toFixed(2));

          await prisma.log.create({
            data: {
              userId,
              campaignId: campaign.id,
              type:       "DECISION_SCALE" as LogType,
              message:    isAutomatic
                ? `Decision Engine — "${campaign.name}" scalée. ROI ${roi.toFixed(1)}% › bid +${scaleIncrement}%`
                : `[RECOMMEND] Decision Engine — "${campaign.name}" : scale suggéré. ROI ${roi.toFixed(1)}% › bid +${scaleIncrement}%`,
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

    // ── Grace period : pas de KILL par ROI tant que le user n'a pas de postback ──
    // Le KILL par budget reste valide (il ne dépend pas du revenue reçu).
    // Loggué une fois par campagne par heure pour éviter le spam.
    if (inGracePeriod && roiTrigger && !budgetTrigger) {
      const recentBlocked = await prisma.log.findFirst({
        where: {
          userId,
          type:       "KILL_BLOCKED_NO_DATA" as LogType,
          campaignId: campaign.id,
          createdAt:  { gte: new Date(Date.now() - 60 * 60_000) },
        },
      });
      if (!recentBlocked) {
        await prisma.log.create({
          data: {
            userId,
            campaignId: campaign.id,
            type:       "KILL_BLOCKED_NO_DATA" as LogType,
            message:    `Kill bloqué — "${campaign.name}" : aucun postback reçu, période de grâce ${GRACE_PERIOD_HOURS}h active`,
            metadata: {
              network:          networkLabel,
              externalId:       campaign.externalId,
              campaignName:     campaign.name,
              spend:            freshSpend,
              revenue:          freshRevenue,
              roi:              parseFloat(roi.toFixed(2)),
              roiThreshold,
              gracePeriodHours: GRACE_PERIOD_HOURS,
              reason:           "no postback received yet — grace period active",
            },
          },
        });
      }
      continue;
    }

    const reason = roiTrigger
      ? `ROI ${roi.toFixed(1)}% < seuil ${roiThreshold}%`
      : `Spend ${freshSpend.toFixed(2)}€ > max ${maxSpendPerCampaign}€`;

    // ── Kill cooldown check ──────────────────────────────────────────────────
    // Ne pas re-killer une campagne si une action DECISION_KILL (réelle, pas holdPending)
    // a déjà eu lieu dans la fenêtre de cooldown configurable (défaut 6h).
    const killCooldownH = engineRule?.killCooldownH ?? 6;
    if (killCooldownH > 0) {
      const recentKillRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Log"
        WHERE "userId"    = ${userId}
          AND "type"      = 'DECISION_KILL'
          AND (metadata->>'holdPending') IS NULL
          AND "createdAt" >= ${new Date(Date.now() - killCooldownH * 60 * 60_000)}
          AND metadata->>'externalId' = ${campaign.externalId}
        LIMIT 1
      `;
      if (recentKillRows.length > 0) { continue; }
    }

    // ── maxKillsDay : limite journalière de kills ─────────────────────────────
    const maxKillsDay = engineRule?.maxKillsDay ?? 5;
    if (maxKillsDay > 0) {
      const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
      const killsTodayRows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM "Log"
        WHERE "userId"    = ${userId}
          AND "type"      = 'DECISION_KILL'
          AND (metadata->>'holdPending') IS NULL
          AND "createdAt" >= ${todayMidnight}
      `;
      if (Number(killsTodayRows[0]?.count ?? 0) >= maxKillsDay) { continue; }
    }

    // ── killHoldMin : condition doit tenir X minutes avant de tuer ────────────
    // Principe : la 1ère fois qu'on détecte la condition, on log un "hold pending"
    // sans tuer. Aux runs suivants, si la condition tient toujours et que X minutes
    // se sont écoulées depuis le 1er log, on tue pour de vrai.
    const killHoldMin = engineRule?.killHoldMin ?? 0;
    if (killHoldMin > 0) {
      const holdRows = await prisma.$queryRaw<{ id: string; createdAt: Date }[]>`
        SELECT id, "createdAt" FROM "Log"
        WHERE "userId"    = ${userId}
          AND "type"      = 'DECISION_KILL'
          AND metadata->>'holdPending' = 'true'
          AND metadata->>'externalId'  = ${campaign.externalId}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      if (holdRows.length === 0) {
        // Première détection — on logue le hold pending et on attend
        await prisma.log.create({
          data: {
            userId,
            campaignId: campaign.id,
            type:       "DECISION_KILL" as LogType,
            message:    `[HOLD] Decision Engine — "${campaign.name}" : kill en attente (${killHoldMin}min). ${reason}`,
            metadata: {
              network:      networkLabel,
              externalId:   campaign.externalId,
              campaignName: campaign.name,
              spend:        freshSpend,
              roi:          parseFloat(roi.toFixed(2)),
              holdPending:  true,
              holdMinutes:  killHoldMin,
              holdUntil:    new Date(Date.now() + killHoldMin * 60_000).toISOString(),
              reason,
            },
          },
        });
        continue;
      }
      const ageMin = (Date.now() - new Date(holdRows[0].createdAt).getTime()) / 60_000;
      if (ageMin < killHoldMin) { continue; } // pas encore assez longtemps
      // Condition tenue assez longtemps → on continue vers le kill réel
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
          : `[RECOMMEND] Decision Engine — "${campaign.name}" : pause suggérée. ${reason}`,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: { scaleRoi: true, scaleIncrement: true, minSpend: true, minConversions: true, killCooldownH: true, scaleCooldownH: true, killHoldMin: true, scaleHoldMin: true, maxKillsDay: true, maxScalesDay: true, engineMode: true, timeWindowStart: true, timeWindowEnd: true } as any,
    }).catch(() => null),
  ]);

  if (!settings?.killSwitchEnabled) { result.skipped = 1; return result; }

  // ── Bloc 6 : Emergency Stop ───────────────────────────────────────────────────
  // Si enginePausedUntil est dans le futur, l'automation est suspendue globalement.
  if (settings.enginePausedUntil && settings.enginePausedUntil > new Date()) {
    result.skipped = 1;
    return result;
  }

  // ── checkIntervalMinutes : fréquence configurable ─────────────────────────────
  // Quand le cron tourne toutes les minutes, on ne veut pas re-évaluer chaque user
  // à chaque minute — seulement toutes les X minutes selon leur config.
  // On utilise un log SYNC (source: decision-engine) comme marqueur de dernier run.
  const checkInterval = settings.checkIntervalMinutes ?? 30;
  if (checkInterval > 0) {
    const lastSync = await prisma.log.findFirst({
      where: {
        userId,
        type:     "SYNC" as LogType,
        metadata: { path: ["source"], equals: "decision-engine" },
      },
      orderBy: { createdAt: "desc" },
      select:  { createdAt: true },
    });
    if (lastSync) {
      const minsSinceSync = (Date.now() - lastSync.createdAt.getTime()) / 60_000;
      if (minsSinceSync < checkInterval) { result.skipped = 1; return result; }
    }
  }

  // ── Vérification plage horaire (UTC) ─────────────────────────────────────────
  const twStart = (decisionRule as { timeWindowStart?: number | null } | null)?.timeWindowStart ?? null;
  const twEnd   = (decisionRule as { timeWindowEnd?:   number | null } | null)?.timeWindowEnd   ?? null;
  if (twStart != null && twEnd != null) {
    const utcHour = new Date().getUTCHours();
    const inWindow = twStart <= twEnd
      ? utcHour >= twStart && utcHour < twEnd
      : utcHour >= twStart || utcHour < twEnd; // overnight window (ex: 22h → 06h)
    if (!inWindow) { result.skipped = 1; return result; }
  }

  const { roiThreshold, maxSpendPerCampaign } = settings;
  const spendOnlyMode = settings.spendOnlyMode ?? false;

  // Règles du Decision Engine (scale / kill / watch thresholds)
  const engineRule: EngineRule | null = decisionRule
    ? {
        scaleRoi:       decisionRule.scaleRoi,
        scaleIncrement: decisionRule.scaleIncrement,
        minSpend:       decisionRule.minSpend,
        minConversions: decisionRule.minConversions,
        killCooldownH:  decisionRule.killCooldownH,
        scaleCooldownH: decisionRule.scaleCooldownH,
        killHoldMin:    (decisionRule as { killHoldMin?: number }).killHoldMin  ?? 30,
        scaleHoldMin:   (decisionRule as { scaleHoldMin?: number }).scaleHoldMin ?? 60,
        maxKillsDay:    (decisionRule as { maxKillsDay?: number }).maxKillsDay  ?? 5,
        maxScalesDay:   (decisionRule as { maxScalesDay?: number }).maxScalesDay ?? 2,
        engineMode:     decisionRule.engineMode,
      }
    : null;

  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
  });

  if (accounts.length === 0) { result.skipped = 1; return result; }

  // ── Garde-fous postback (défense en profondeur) ─────────────────────────────
  // 1. inGracePeriod : si aucun postback reçu ET premier réseau connecté
  //    il y a moins de 48h → les kills par ROI seront bloqués.
  // 2. Downgrade auto : après 48h sans postback en mode automatic → bascule
  //    forcée en mode recommendation pour éviter un massacre de campagnes.
  //
  // Exception : spend-only mode. L'utilisateur a explicitement choisi de kill
  // uniquement sur budget (sans revenue). Pas besoin de postback, pas de garde.
  let inGracePeriod = false;
  if (!spendOnlyMode) {
    const [firstPostback, oldestAccount] = await Promise.all([
      prisma.conversion.findFirst({
        where:  { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      prisma.account.findFirst({
        where:  { userId, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const hasAnyPostback = firstPostback !== null;
    const now            = Date.now();
    const graceMs        = GRACE_PERIOD_HOURS * 60 * 60_000;

    if (!hasAnyPostback && oldestAccount) {
      const connectedSinceMs = now - oldestAccount.createdAt.getTime();

      if (connectedSinceMs < graceMs) {
        // Toujours dans la fenêtre de grâce — on bloquera les kills par ROI
        inGracePeriod = true;
      } else if (engineRule?.engineMode === "automatic") {
        // Passé 48h sans postback en mode automatic → downgrade vers recommendation
        try {
          await prisma.decisionRule.update({
            where: { userId },
            data:  { engineMode: "recommendation" },
          });
          engineRule.engineMode = "recommendation";

          // Log une seule fois par 24h pour éviter le spam
          const recentDowngrade = await prisma.log.findFirst({
            where: {
              userId,
              type:      "SAFETY_DOWNGRADE" as LogType,
              createdAt: { gte: new Date(now - 24 * 60 * 60_000) },
            },
          });
          if (!recentDowngrade) {
            await prisma.log.create({
              data: {
                userId,
                type:    "SAFETY_DOWNGRADE" as LogType,
                message: `Engine basculé en mode Recommend — aucun postback reçu après ${GRACE_PERIOD_HOURS}h`,
                metadata: {
                  hoursSinceFirstConnection: Math.round(connectedSinceMs / (60 * 60_000)),
                  gracePeriodHours:          GRACE_PERIOD_HOURS,
                  previousMode:              "automatic",
                  newMode:                   "recommendation",
                  reason:                    "no postback received after grace period",
                },
              },
            });
          }
        } catch (err) {
          result.errors.push(`safety-downgrade(${userId}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

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
        (id, mult) => adapter.scaleBid(id, mult), engineRule, inGracePeriod);
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
        (id, mult) => adapter.scaleBid(id, mult), engineRule, inGracePeriod);
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
        (id, mult) => adapter.scaleBid(id, mult),
        engineRule, inGracePeriod);
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
        // scaleBid retourne { ok, oldRates, newRates } — on adapte au format
        // attendu par evaluateCampaigns ({ oldBid, newBid }).
        (id, mult) => PropellerAds.scaleBid(apiKey, id, mult).then(r => ({
          oldBid: r.oldRates[0]?.amount ?? 0,
          newBid: r.newRates[0]?.amount ?? 0,
        })),
        engineRule, inGracePeriod);
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
        (id, mult) => Adsterra.scaleBid(apiKey, id, mult),
        engineRule, inGracePeriod);
    }
  }

  // ── budgetAlertEnabled : alerte si spend journalier dépasse la limite ─────────
  // Loggué une seule fois par jour pour éviter le spam.
  if (settings.budgetAlertEnabled && settings.dailyBudgetLimit) {
    try {
      const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
      const spendRows = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(spend), 0) AS total
        FROM "Campaign"
        WHERE "userId"   = ${userId}
          AND "dateFrom" >= ${todayMidnight}
      `;
      const todaySpend = Number(spendRows[0]?.total ?? 0);
      if (todaySpend > settings.dailyBudgetLimit) {
        const alreadyAlerted = await prisma.log.findFirst({
          where: { userId, type: "BUDGET_ALERT" as LogType, createdAt: { gte: todayMidnight } },
        });
        if (!alreadyAlerted) {
          await prisma.log.create({
            data: {
              userId,
              type:    "BUDGET_ALERT" as LogType,
              message: `Alerte budget — dépense journalière $${todaySpend.toFixed(2)} dépasse la limite $${settings.dailyBudgetLimit.toFixed(2)}`,
              metadata: {
                todaySpend,
                dailyBudgetLimit: settings.dailyBudgetLimit,
                excess:           parseFloat((todaySpend - settings.dailyBudgetLimit).toFixed(2)),
              },
            },
          });
        }
      }
    } catch (err) {
      result.errors.push(`budget-alert(${userId}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Log SYNC — marqueur de dernier run (utilisé par checkIntervalMinutes) ─────
  try {
    await prisma.log.create({
      data: {
        userId,
        type:    "SYNC" as LogType,
        message: `Decision Engine — scan terminé. ${result.checked} campagnes évaluées, ${result.killed} kills, ${result.scaled} scales.`,
        metadata: { source: "decision-engine", checked: result.checked, killed: result.killed, scaled: result.scaled },
      },
    });
  } catch { /* non-bloquant */ }

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
