import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter, ExoClickCreateParams } from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter, TrafficStarsCreateParams, TrafficStarsCreateBannerParams } from "@/lib/adapters/trafficstars";
// TrafficJunky adapter imported for future use; createCampaign not available (TJ API 405).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import { Network, CampaignStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown> & { network?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

    const network = body.network as string | undefined;

    if (!network) return NextResponse.json({ error: "Network is required" }, { status: 400 });
    if (!(body.name as string)?.trim()) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });

    // Load account
    const account = await prisma.account.findFirst({
      where: { userId: user.id, network: network as Network, isActive: true },
    });
    if (!account) return NextResponse.json({ error: `No ${network} account connected` }, { status: 404 });

    const apiKey = decrypt(account.apiKeyEnc);

    if (network === Network.EXOCLICK) {
      const params = body as unknown as ExoClickCreateParams;
      if (!params.bid || params.bid <= 0) return NextResponse.json({ error: "Invalid bid" }, { status: 400 });
      const adapter = new ExoClickAdapter(apiKey);
      const created = await adapter.createCampaign(params);

      // Save in DB
      const today = new Date().toISOString().slice(0, 10);
      const camp = await prisma.campaign.create({
        data: {
          userId:      user.id,
          accountId:   account.id,
          externalId:  created.id,
          name:        created.name,
          network:     Network.EXOCLICK,
          status:      params.active ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
          spend:       0,
          revenue:     0,
          impressions: 0,
          clicks:      0,
          conversions: 0,
          dateFrom:    new Date(today),
          dateTo:      new Date(today),
          syncedAt:    new Date(),
        },
      });

      await prisma.log.create({
        data: {
          userId:  user.id,
          type:    "CAMPAIGN_ACTION",
          message: `Campaign created on ExoClick: "${created.name}" (ID ${created.id})`,
          metadata: { network: "EXOCLICK", externalId: created.id },
        },
      });

      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name } });
    }

    if (network === Network.TRAFFICSTARS) {
      const tsParams = body as unknown as TrafficStarsCreateParams;
      if (!tsParams.format_id)     return NextResponse.json({ error: "Format is required"       }, { status: 400 });
      if (!tsParams.pricing_model) return NextResponse.json({ error: "Pricing model is required" }, { status: 400 });
      if (!tsParams.price || tsParams.price <= 0)     return NextResponse.json({ error: "Invalid bid"           }, { status: 400 });
      if (!tsParams.max_daily || tsParams.max_daily <= 0) return NextResponse.json({ error: "Invalid daily budget" }, { status: 400 });

      const adapter = new TrafficStarsAdapter(apiKey);
      const created = await adapter.createCampaign(tsParams);

      // Attach a banner/creative if a destination URL was provided.
      // For Popunder (format_id=7) and image formats, the campaign needs a banner
      // with a redirect URL to start delivering. Without one it stays in "no creative" state.
      const destinationUrl = (body as Record<string, unknown>).url as string | undefined;
      if (destinationUrl?.trim()) {
        try {
          const bannerParams: TrafficStarsCreateBannerParams = {
            campaign_id: Number(created.id),
            name:        `${tsParams.name} - Banner`,
            url:         destinationUrl.trim(),
          };
          await adapter.createBanner(bannerParams);
        } catch (bannerErr) {
          // Non-fatal: campaign was created, banner attachment failed.
          // Log the error but don't reject the whole creation.
          console.warn("[/api/campaigns/create] TS banner creation failed (non-fatal):", bannerErr);
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      const camp  = await prisma.campaign.create({
        data: {
          userId:      user.id,
          accountId:   account.id,
          externalId:  created.id,
          name:        created.name,
          network:     Network.TRAFFICSTARS,
          status:      tsParams.active ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
          spend:       0,
          revenue:     0,
          impressions: 0,
          clicks:      0,
          conversions: 0,
          dateFrom:    new Date(today),
          dateTo:      new Date(today),
          syncedAt:    new Date(),
        },
      });

      await prisma.log.create({
        data: {
          userId:   user.id,
          type:     "CAMPAIGN_ACTION",
          message:  `Campaign created on TrafficStars: "${created.name}" (ID ${created.id})`,
          metadata: { network: "TRAFFICSTARS", externalId: created.id },
        },
      });

      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name } });
    }

    // TrafficJunky: their V1 API does not expose a POST /campaigns endpoint (405).
    // Campaign creation must be done on the TrafficJunky dashboard, then synced here.
    if (network === Network.TRAFFICJUNKY) {
      return NextResponse.json({
        error: "TrafficJunky does not support campaign creation via API. Please create the campaign on trafficjunky.com, then sync it here.",
      }, { status: 422 });
    }

    return NextResponse.json({ error: `Network not supported for creation: ${network}` }, { status: 400 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/campaigns/create] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
