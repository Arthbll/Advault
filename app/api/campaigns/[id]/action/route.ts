import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter }    from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import * as PropellerAds       from "@/lib/adapters/propellerads";
import * as Adsterra           from "@/lib/adapters/adsterra";
import * as Voluum             from "@/lib/adapters/voluum";
import * as Bemob              from "@/lib/adapters/bemob";
import { Network, CampaignStatus } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { assertCanMutate } from "@/lib/team-role";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const viewerBlock = await assertCanMutate(user.id);
  if (viewerBlock) return viewerBlock;

  const userId = await resolveWorkspaceUserId(user.id);

  const { id } = await params;
  const body = await req.json() as {
    action:          "pause" | "resume" | "kill" | "scale" | "archive";
    force?:          boolean; // skip network API call — DB-only status correction
    multiplier?:     number;  // budget multiplier (legacy, default 1.25)
    budgetAmount?:   number;  // set daily budget to fixed € amount
    bidMultiplier?:  number;  // scale bid by this factor (e.g. 1.10 = +10%)
    bidAmount?:      number;  // set bid to fixed € amount
  };
  const { action } = body;
  const forceDbOnly = body.force === true;
  const scaleMultiplier = body.multiplier ?? 1.25; // default +25% budget scale

  const campaign = await prisma.campaign.findFirst({
    where: { id, userId: userId },
    include: { account: true },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  try {
    const apiKey        = decrypt(campaign.account.apiKeyEnc);
    const sessionCookie = campaign.account.apiSecretEnc
      ? decrypt(campaign.account.apiSecretEnc)
      : undefined;

    // ── Call network API (skipped if force=true) ──────────────────────────────
    if (!forceDbOnly && (action === "pause" || action === "kill")) {
      if (campaign.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        const adapter = new TrafficJunkyAdapter(apiKey);
        await adapter.pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.PROPELLERADS) {
        await PropellerAds.pauseCampaign(apiKey, campaign.externalId);
      } else if (campaign.network === Network.ADSTERRA) {
        await Adsterra.pauseCampaign(apiKey, campaign.externalId);
      } else if (campaign.network === Network.VOLUUM && sessionCookie) {
        // Voluum: apiKey = accessId, sessionCookie = accessKey
        await Voluum.pauseCampaign(apiKey, sessionCookie, campaign.externalId);
      } else if (campaign.network === Network.BEMOB && sessionCookie) {
        // Bemob: apiKey = accessKey, sessionCookie = secretKey
        await Bemob.pauseCampaign(apiKey, sessionCookie, campaign.externalId);
      }
    } else if (!forceDbOnly && action === "resume") {
      if (campaign.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        await adapter.resumeCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        await adapter.resumeCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        const adapter = new TrafficJunkyAdapter(apiKey);
        await adapter.resumeCampaign(campaign.externalId);
      } else if (campaign.network === Network.PROPELLERADS) {
        await PropellerAds.resumeCampaign(apiKey, campaign.externalId);
      } else if (campaign.network === Network.ADSTERRA) {
        await Adsterra.resumeCampaign(apiKey, campaign.externalId);
      } else if (campaign.network === Network.VOLUUM && sessionCookie) {
        await Voluum.resumeCampaign(apiKey, sessionCookie, campaign.externalId);
      } else if (campaign.network === Network.BEMOB && sessionCookie) {
        await Bemob.resumeCampaign(apiKey, sessionCookie, campaign.externalId);
      }
    } else if (!forceDbOnly && action === "scale") {
      // Scale = augmentation du bid CPM/CPC par défaut.
      // bidMultiplier explicite > multiplier générique > 1.25 par défaut.
      const bidMult = body.bidMultiplier ?? scaleMultiplier;
      if (campaign.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        if (body.bidAmount != null) {
          await adapter.setBid(campaign.externalId, body.bidAmount);
        } else {
          await adapter.scaleBid(campaign.externalId, bidMult);
        }
      } else if (campaign.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        if (body.bidAmount != null) {
          await adapter.setBid(campaign.externalId, body.bidAmount);
        } else {
          await adapter.scaleBid(campaign.externalId, bidMult);
        }
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        const adapter = new TrafficJunkyAdapter(apiKey);
        if (body.bidAmount != null) {
          await adapter.setBid(campaign.externalId, body.bidAmount);
        } else {
          await adapter.scaleBid(campaign.externalId, bidMult);
        }
      } else if (campaign.network === Network.PROPELLERADS) {
        if (body.bidAmount != null) {
          await PropellerAds.setBid(apiKey, campaign.externalId, body.bidAmount);
        } else {
          await PropellerAds.scaleBid(apiKey, campaign.externalId, bidMult);
        }
      } else if (campaign.network === Network.ADSTERRA) {
        // Bid updates via internal web-panel API (requires rst4-uid session cookie
        // stored in account.apiSecretEnc). Throws if cookie not set.
        if (body.bidAmount != null) {
          await Adsterra.setBid(apiKey, campaign.externalId, body.bidAmount, sessionCookie);
        } else {
          await Adsterra.scaleBid(apiKey, campaign.externalId, bidMult, sessionCookie);
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
        metadata: { campaignId: id, externalId: campaign.externalId, action, campaignName: campaign.name, network: campaign.network },
      },
    });

    return NextResponse.json({ ok: true, status: newStatus ?? campaign.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
