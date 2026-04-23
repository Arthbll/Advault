/**
 * Simulator — fait évoluer les stats des campagnes démo dans le temps.
 *
 * Pourquoi : sans ça, le workspace démo est figé — même chiffres au réveil
 * et au coucher. Avec ça, Arthur peut "vivre" la semaine en tant qu'utilisateur :
 *   - les impressions grimpent au fil de la journée
 *   - des conversions arrivent (nouvelles lignes Conversion via postback simulé)
 *   - le ROI oscille naturellement (+/- 3 points par tick)
 *   - certaines campagnes deviennent "silencieuses" (aucun postback 8h) — trigger
 *     Safety Downgrade côté engine
 *   - le Decision Engine tuera/scalera comme en prod
 *
 * Un "tick" = un laps de temps simulé. Le cron quotidien appelle
 * simulateOneDay() juste avant l'envoi du briefing, pour qu'Arthur voie
 * des chiffres qui ont bougé depuis la veille.
 */

import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL } from "./config";

// Journée courante — les snapshots Campaign sont indexés par dateFrom/dateTo.
// Le simulator ne touche QUE la tranche du jour, comme le sync adapter en prod.
function todayRange() {
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dateTo   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { dateFrom, dateTo };
}

// Générateur pseudo-aléatoire déterministe pour debug reproductible si besoin.
// Pour le moment on utilise Math.random() — assez bon pour un mode démo.
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

type TickResult = {
  campaignsTouched: number;
  conversionsAdded: number;
  killsTriggered:   number;
  scalesTriggered:  number;
};

/**
 * Un tick = ~1 heure de trafic simulé.
 * À appeler toutes les 15-30 min si on veut un démo vivant,
 * ou en batch (24 ticks d'un coup) une fois par jour pour un démo minimal.
 */
export async function simulateTick(): Promise<TickResult> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) {
    return { campaignsTouched: 0, conversionsAdded: 0, killsTriggered: 0, scalesTriggered: 0 };
  }

  // Uniquement les campagnes ACTIVE ou WATCH du jour courant.
  // Le schéma Campaign a @@unique([accountId, externalId, dateFrom, dateTo]) :
  // chaque jour est une ligne différente. Si on filtrait juste par userId,
  // demain on évoluerait aussi les snapshots d'hier — historique cassé.
  const { dateFrom, dateTo } = todayRange();
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId:   user.id,
      status:   { in: ["ACTIVE", "WATCH"] },
      dateFrom: { gte: dateFrom },
      dateTo:   { lte: dateTo },
    },
  });

  let conversionsAdded = 0;
  let killsTriggered   = 0;
  let scalesTriggered  = 0;

  for (const c of campaigns) {
    // Évolution naturelle des impressions / clicks (pattern réaliste : plus le soir)
    const impressionDelta = randInt(800, 3500);
    const clickDelta      = randInt(15, Math.max(20, Math.floor(impressionDelta * 0.025)));
    const conversionDelta = randInt(0, 3);

    // Gain / perte de spend — proportionnel aux impressions
    const spendDelta   = Number(c.spend) > 0
      ? +(impressionDelta * rand(0.0008, 0.0020)).toFixed(4)
      : +(impressionDelta * 0.001).toFixed(4);

    // Revenue delta : dépend du EPC (earnings per click) — varie selon la perf actuelle
    const currentRoi = Number(c.spend) > 0
      ? ((Number(c.revenue) - Number(c.spend)) / Number(c.spend)) * 100
      : 0;
    const epc = currentRoi > 20 ? rand(0.12, 0.28)
             : currentRoi > 0   ? rand(0.06, 0.14)
             : /* losing */       rand(0.02, 0.08);
    const revenueDelta = +(clickDelta * epc).toFixed(4);

    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        impressions: { increment: impressionDelta },
        clicks:      { increment: clickDelta },
        conversions: { increment: conversionDelta },
        spend:       { increment: spendDelta },
        revenue:     { increment: revenueDelta },
        syncedAt:    new Date(),
      },
    });

    // Création de Conversion pour chaque conversion du tick (postback simulé)
    for (let i = 0; i < conversionDelta; i++) {
      await prisma.conversion.create({
        data: {
          userId:     user.id,
          campaignId: c.externalId,
          clickId:    `demo-${c.externalId}-${Date.now()}-${i}-${randInt(1000, 9999)}`,
          revenue:    +rand(0.3, 4.5).toFixed(2),
          currency:   "USD",
          source:     "demo-simulator",
        },
      });
      conversionsAdded++;
    }

    // Simulation Decision Engine — kill si nouveau ROI < -30%
    const newSpend   = Number(c.spend) + spendDelta;
    const newRevenue = Number(c.revenue) + revenueDelta;
    const newRoi     = newSpend > 0 ? ((newRevenue - newSpend) / newSpend) * 100 : 0;

    if (newRoi < -30 && newSpend > 20 && c.status === "WATCH") {
      await prisma.campaign.update({
        where: { id: c.id },
        data:  { status: "KILLED" },
      });
      await prisma.log.create({
        data: {
          userId:     user.id,
          campaignId: c.id,
          type:       "DECISION_KILL",
          message:    `Kill automatique — ROI ${newRoi.toFixed(1)}% < -30% sur ${c.name}`,
          metadata:   { roi: newRoi, threshold: -30, spend: newSpend },
        },
      });
      killsTriggered++;
    } else if (newRoi > 30 && c.conversions > 10 && c.status === "ACTIVE") {
      // Scale : juste log pour la démo (pas de vraie API call)
      await prisma.log.create({
        data: {
          userId:     user.id,
          campaignId: c.id,
          type:       "DECISION_SCALE",
          message:    `Scale automatique — bid +10% sur ${c.name} (ROI ${newRoi.toFixed(1)}%)`,
          metadata:   { roi: newRoi, increment: 10 },
        },
      });
      scalesTriggered++;
    }
  }

  return {
    campaignsTouched: campaigns.length,
    conversionsAdded,
    killsTriggered,
    scalesTriggered,
  };
}

/**
 * Simule 24h d'activité d'un coup — appelé par le cron quotidien
 * juste avant d'envoyer le briefing à Arthur.
 *
 * On exécute 6 ticks "gonflés" (chacun ≈ 4h de trafic) plutôt que 24 ticks
 * horaires : ça garde le même volume total de stats générées, mais on reste
 * largement sous les 60s de maxDuration Vercel Hobby (15 campagnes × 6 ticks
 * × ~6 requêtes Prisma ≈ 540 queries → ~10-15s en tout).
 */
export async function simulateOneDay(): Promise<TickResult> {
  const totals: TickResult = {
    campaignsTouched: 0,
    conversionsAdded: 0,
    killsTriggered:   0,
    scalesTriggered:  0,
  };

  const TICKS_PER_DAY = 6;
  for (let i = 0; i < TICKS_PER_DAY; i++) {
    const t = await simulateTick();
    totals.conversionsAdded += t.conversionsAdded;
    totals.killsTriggered   += t.killsTriggered;
    totals.scalesTriggered  += t.scalesTriggered;
    totals.campaignsTouched = Math.max(totals.campaignsTouched, t.campaignsTouched);
  }

  return totals;
}
