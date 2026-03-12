/**
 * Kill-Switch automatique
 * POST /api/cron/kill-switch — appelé par cron ou manuellement depuis le dashboard
 * Vérifie tous les comptes actifs, calcule le ROI, pause les campagnes sous le seuil
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { Network, CampaignStatus, LogType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Charger les settings kill-switch
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });

  if (!settings?.killSwitchEnabled) {
    return NextResponse.json({ skipped: true, reason: "Kill-Switch désactivé" });
  }

  const roiThreshold      = settings.roiThreshold;       // ex: -50
  const maxSpend          = settings.maxSpendPerCampaign; // ex: 100 ou null

  // Charger toutes les campagnes ACTIVE de l'utilisateur
  const campaigns = await prisma.campaign.findMany({
    where:   { userId: user.id, status: CampaignStatus.ACTIVE },
    include: { account: true },
    orderBy: { spend: "desc" },
  });

  const killed: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const campaign of campaigns) {
    const spend   = Number(campaign.spend);
    const revenue = Number(campaign.revenue);
    const roi     = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

    const shouldKill =
      (roi < roiThreshold) ||
      (maxSpend !== null && maxSpend !== undefined && spend >= maxSpend);

    if (!shouldKill) {
      skipped.push(campaign.name);
      continue;
    }

    try {
      // Pause côté réseau
      if (campaign.network === Network.EXOCLICK) {
        const apiKey  = decrypt(campaign.account.apiKeyEnc);
        const adapter = new ExoClickAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      }
      // (TrafficStars, TrafficJunky à ajouter ici)

      // Mettre à jour le statut en DB
      await prisma.campaign.updateMany({
        where: { externalId: campaign.externalId, userId: user.id },
        data:  { status: CampaignStatus.KILLED },
      });

      // Log l'événement
      await prisma.log.create({
        data: {
          userId:     user.id,
          campaignId: campaign.id,
          type:       LogType.KILL_SWITCH_TRIGGERED,
          message:    `Kill-Switch → ${campaign.name} (ROI ${roi.toFixed(1)}% < seuil ${roiThreshold}%)`,
          metadata:   { roi: roi.toFixed(2), threshold: roiThreshold, spend, revenue, network: campaign.network },
        },
      });

      killed.push(campaign.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${campaign.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    ok:       true,
    checked:  campaigns.length,
    killed:   killed.length,
    killedList: killed,
    skipped:  skipped.length,
    errors:   errors.length > 0 ? errors : undefined,
    threshold: roiThreshold,
    maxSpend,
  });
}

// GET — statut rapide (derniers kills, settings actifs)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, recentKills] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.log.findMany({
      where:   { userId: user.id, type: LogType.KILL_SWITCH_TRIGGERED },
      orderBy: { createdAt: "desc" },
      take:    10,
      select:  { message: true, createdAt: true, metadata: true },
    }),
  ]);

  return NextResponse.json({ settings, recentKills });
}
