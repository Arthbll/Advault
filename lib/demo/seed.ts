/**
 * Seed du workspace démo.
 *
 * Idempotent : relancer le seed N fois = même résultat. Aucun duplicata.
 *
 * Contrat :
 *   - crée le user démo s'il n'existe pas
 *   - crée un Account fictif (pas de vraie API key) pour permettre la FK Campaign→Account
 *   - insère les 15 campagnes Dating
 *   - crée les UserSettings et DecisionRule par défaut
 *
 * Ne crée pas de Conversion — le simulator s'en charge au premier tick.
 */

import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL } from "./config";
import { DEMO_CAMPAIGNS } from "./campaigns";

// Période du snapshot initial — aujourd'hui
function todayRange() {
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dateTo   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { dateFrom, dateTo };
}

export async function ensureDemoUser(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  const user = await prisma.user.create({
    data: {
      email: DEMO_USER_EMAIL,
      tier:  "SOLO",
      settings: {
        create: {
          timezone:             "Europe/Paris",
          currency:             "USD",
          killSwitchEnabled:    true,
          roiThreshold:         -30,
          maxSpendPerCampaign:  500,
          checkIntervalMinutes: 30,
        },
      },
      decisionRule: {
        create: {
          preset:     "balanced",
          engineMode: "automatic",
        },
      },
    },
    select: { id: true },
  });
  return user.id;
}

export async function ensureDemoAccount(userId: string): Promise<string> {
  const existing = await prisma.account.findUnique({
    where: { userId_network: { userId, network: "EXOCLICK" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const account = await prisma.account.create({
    data: {
      userId,
      network:      "EXOCLICK",
      // Fausses creds — le mode démo ne fait AUCUN appel API réel vers ExoClick
      apiKeyEnc:    "demo-not-a-real-key",
      apiSecretEnc: "demo-not-a-real-secret",
      label:        "Demo ExoClick Account",
      isActive:     false, // isActive=false → sync adapter ne touche pas
    },
    select: { id: true },
  });
  return account.id;
}

export async function seedDemoCampaigns(userId: string, accountId: string) {
  const { dateFrom, dateTo } = todayRange();

  // upsert plutôt que create — idempotence garantie via la contrainte
  // UNIQUE [accountId, externalId, dateFrom, dateTo]
  let created = 0;
  let updated = 0;

  for (const camp of DEMO_CAMPAIGNS) {
    const result = await prisma.campaign.upsert({
      where: {
        accountId_externalId_dateFrom_dateTo: {
          accountId,
          externalId: camp.externalId,
          dateFrom,
          dateTo,
        },
      },
      update: {
        spend:       camp.spend,
        revenue:     camp.revenue,
        impressions: camp.impressions,
        clicks:      camp.clicks,
        conversions: camp.conversions,
        status:      camp.status,
        syncedAt:    new Date(),
      },
      create: {
        userId,
        accountId,
        externalId:  camp.externalId,
        name:        camp.name,
        network:     camp.network,
        status:      camp.status,
        spend:       camp.spend,
        revenue:     camp.revenue,
        impressions: camp.impressions,
        clicks:      camp.clicks,
        conversions: camp.conversions,
        dateFrom,
        dateTo,
      },
    });
    // Prisma ne retourne pas "created vs updated", on estime via createdAt
    const age = Date.now() - result.createdAt.getTime();
    if (age < 2000) created++;
    else updated++;
  }

  return { created, updated, total: DEMO_CAMPAIGNS.length };
}

/**
 * Point d'entrée principal — crée tout ce qu'il faut pour avoir un workspace
 * démo prêt à l'emploi. Idempotent.
 */
export async function seedDemoWorkspace() {
  const userId    = await ensureDemoUser();
  const accountId = await ensureDemoAccount(userId);
  const campaigns = await seedDemoCampaigns(userId, accountId);
  return { userId, accountId, campaigns };
}
