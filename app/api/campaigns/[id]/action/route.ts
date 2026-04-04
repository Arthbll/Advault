import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter }    from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import { Network, CampaignStatus } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  const { id } = await params;
  const body = await req.json() as {
    action:          "pause" | "resume" | "kill" | "scale" | "archive";
    multiplier?:     number;  // budget multiplier (legacy, default 1.25)
    budgetAmount?:   number;  // set daily budget to fixed € amount
    bidMultiplier?:  number;  // scale bid by this factor (e.g. 1.10 = +10%)
    bidAmount?:      number;  // set bid to fixed € amount
  };
  const { action } = body;
  const scaleMultiplier = body.multiplier ?? 1.25; // default +25% budget scale

  // ── Demo mode fast-path ───────────────────────────────────────────────────
  if (id.startsWith("demo:")) {
    const demoStatus =
      action === "kill"    ? "KILLED"   :
      action === "pause"   ? "PAUSED"   :
      action === "resume"  ? "ACTIVE"   :
      action === "archive" ? "ARCHIVED" :
      undefined; // scale: no status change
    return NextResponse.json({ ok: true, demo: true, status: demoStatus ?? "ACTIVE" });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: userId },
    include: { account: true },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  try {
    const apiKey = decrypt(campaign.account.apiKeyEnc);

    // ── Call network API ───────────────────────────────────────────────────────
    if (action === "pause" || action === "kill") {
      if (campaign.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        const adapter = new TrafficJunkyAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      }
    } else if (action === "resume") {
      if (campaign.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        await adapter.resumeCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        await adapter.resumeCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        const adapter = new TrafficJunkyAdapter(apiKey);
        await adapter.resumeCampaign(campaign.externalId);
      }
    } else if (action === "scale") {
      if (campaign.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        // Budget
        if (body.budgetAmount != null) {
          await adapter.setDailyBudget(campaign.externalId, body.budgetAmount);
        } else {
          await adapter.scaleDailyBudget(campaign.externalId, scaleMultiplier);
        }
        // Bid (optional)
        if (body.bidAmount != null) {
          await adapter.setBid(campaign.externalId, body.bidAmount);
        } else if (body.bidMultiplier != null) {
          await adapter.scaleBid(campaign.externalId, body.bidMultiplier);
        }
      } else if (campaign.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        if (body.budgetAmount != null) {
          await adapter.setDailyBudget(campaign.externalId, body.budgetAmount);
        } else {
          await adapter.scaleDailyBudget(campaign.externalId, scaleMultiplier);
        }
        if (body.bidAmount != null) {
          await adapter.setBid(campaign.externalId, body.bidAmount);
        } else if (body.bidMultiplier != null) {
          await adapter.scaleBid(campaign.externalId, body.bidMultiplier);
        }
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        const adapter = new TrafficJunkyAdapter(apiKey);
        if (body.budgetAmount != null) {
          await adapter.setDailyBudget(campaign.externalId, body.budgetAmount);
        } else {
          await adapter.scaleDailyBudget(campaign.externalId, scaleMultiplier);
        }
        if (body.bidAmount != null) {
          await adapter.setBid(campaign.externalId, body.bidAmount);
        } else if (body.bidMultiplier != null) {
          await adapter.scaleBid(campaign.externalId, body.bidMultiplier);
        }
      }
    }
    // archive → no external API call needed

    // ── Update DB status ───────────────────────────────────────────────────────
    const newStatus =
      action === "kill"    ? CampaignStatus.KILLED   :
      action === "pause"   ? CampaignStatus.PAUSED   :
      action === "resume"  ? CampaignStatus.ACTIVE   :
      action === "archive" ? CampaignStatus.ARCHIVED :
      undefined; // scale: no status change

    if (newStatus !== undefined) {
      await prisma.campaign.updateMany({
        where: { externalId: campaign.externalId, userId: userId },
        data:  { status: newStatus },
      });
    }

    // ── Log ───────────────────────────────────────────────────────────────────
    await prisma.log.create({
      data: {
        userId:   userId,
        type:     action === "kill" ? "KILL_SWITCH_TRIGGERED" : "CAMPAIGN_ACTION",
        message:  `${action.toUpperCase()} → ${campaign.name} (${campaign.network})`,
        metadata: { campaignId: id, externalId: campaign.externalId, action },
      },
    });

    return NextResponse.json({ ok: true, status: newStatus ?? campaign.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
