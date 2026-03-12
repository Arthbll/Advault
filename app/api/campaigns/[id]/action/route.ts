import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { Network, CampaignStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json() as { action: "pause" | "resume" | "kill" };

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: user.id },
    include: { account: true },
  });

  if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

  try {
    if (campaign.network === Network.EXOCLICK) {
      const apiKey  = decrypt(campaign.account.apiKeyEnc);
      const adapter = new ExoClickAdapter(apiKey);

      if (action === "pause" || action === "kill") {
        await adapter.pauseCampaign(campaign.externalId);
      } else if (action === "resume") {
        await adapter.resumeCampaign(campaign.externalId);
      }
    }

    const newStatus =
      action === "kill"   ? CampaignStatus.KILLED  :
      action === "pause"  ? CampaignStatus.PAUSED  :
      CampaignStatus.ACTIVE;

    await prisma.campaign.updateMany({
      where: { externalId: campaign.externalId, userId: user.id },
      data:  { status: newStatus },
    });

    await prisma.log.create({
      data: {
        userId:   user.id,
        type:     action === "kill" ? "KILL_SWITCH_TRIGGERED" : "CAMPAIGN_ACTION",
        message:  `${action.toUpperCase()} → ${campaign.name} (${campaign.network})`,
        metadata: { campaignId: id, externalId: campaign.externalId, action },
      },
    });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
