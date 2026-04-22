/**
 * POST /api/campaigns/kill-all
 * Pause ALL active campaigns across ALL networks for the user.
 * Emergency kill-switch.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter }    from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import * as PropellerAds       from "@/lib/adapters/propellerads";
import * as Adsterra           from "@/lib/adapters/adsterra";
import { Network, CampaignStatus } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { assertCanMutate } from "@/lib/team-role";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const viewerBlock = await assertCanMutate(user.id);
  if (viewerBlock) return viewerBlock;

  const userId = await resolveWorkspaceUserId(user.id);

  const accounts = await prisma.account.findMany({
    where: { userId: userId, isActive: true },
  });

  let paused  = 0;
  let errors: string[] = [];

  for (const account of accounts) {
    try {
      const apiKey = decrypt(account.apiKeyEnc);

      // Fetch active campaigns for this network
      const activeCampaigns = await prisma.campaign.findMany({
        where: { userId: userId, accountId: account.id, status: CampaignStatus.ACTIVE },
        distinct: ["externalId"],
        orderBy: { syncedAt: "desc" },
      });

      for (const campaign of activeCampaigns) {
        try {
          if (account.network === Network.EXOCLICK) {
            const adapter = new ExoClickAdapter(apiKey);
            await adapter.pauseCampaign(campaign.externalId);
          } else if (account.network === Network.TRAFFICSTARS) {
            const adapter = new TrafficStarsAdapter(apiKey);
            await adapter.pauseCampaign(campaign.externalId);
          } else if (account.network === Network.TRAFFICJUNKY) {
            const adapter = new TrafficJunkyAdapter(apiKey);
            await adapter.pauseCampaign(campaign.externalId);
          } else if (account.network === Network.PROPELLERADS) {
            await PropellerAds.pauseCampaign(apiKey, campaign.externalId);
          } else if (account.network === Network.ADSTERRA) {
            await Adsterra.pauseCampaign(apiKey, campaign.externalId);
          }
          paused++;
        } catch (e) {
          errors.push(`${campaign.network}/${campaign.externalId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      errors.push(`${account.network}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Update all ACTIVE campaigns to PAUSED in DB
  await prisma.campaign.updateMany({
    where: { userId: userId, status: CampaignStatus.ACTIVE },
    data:  { status: CampaignStatus.PAUSED },
  });

  // Log the kill-switch event
  await prisma.log.create({
    data: {
      userId:   userId,
      type:     "KILL_SWITCH_TRIGGERED",
      message:  `[KILL-ALL] ${paused} campagne(s) mises en pause via kill-switch global`,
      metadata: { paused, errors: errors.length },
    },
  });

  return NextResponse.json({ ok: true, paused, errors: errors.length > 0 ? errors : undefined });
}
