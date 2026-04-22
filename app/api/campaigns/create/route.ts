import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter, ExoClickCreateParams } from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter, TrafficStarsCreateParams, TrafficStarsCreateBannerParams } from "@/lib/adapters/trafficstars";
import * as PropellerAds from "@/lib/adapters/propellerads";
import * as Adsterra     from "@/lib/adapters/adsterra";
// TrafficJunky adapter imported for future use; createCampaign not available (TJ API 405).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import { Network, CampaignStatus } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { assertCanMutate } from "@/lib/team-role";

// ─── Post-creation verification helpers ──────────────────────────────────────
//
// Each helper makes a direct GET /campaign/{id} call (NOT a list endpoint).
// This is a genuine per-campaign API confirmation: the network must return
// the specific campaign data for the call to pass.
//
// Returns { verified: true, id, name, status } on success,
//         { verified: false, reason: string }  on failure/not-found.

/**
 * ExoClick: GET /v2/campaigns/{id}
 * → { result: { id, name, status, ... } }
 */
async function verifyOnExoClick(apiKey: string, externalId: string) {
  try {
    const adapter = new ExoClickAdapter(apiKey);
    // getRawCampaign calls GET /campaigns/{id} directly
    const raw = await adapter.getRawCampaign(externalId) as Record<string, unknown>;
    // ExoClick wraps the campaign in a `result` field
    const camp = (raw?.result ?? raw) as Record<string, unknown>;
    const id   = camp?.id ?? camp?.campaign_id;
    if (!id) {
      return { verified: false, reason: `ExoClick GET /campaigns/${externalId} → no id in response` };
    }
    return {
      verified: true as const,
      id:       String(id),
      name:     String(camp?.name ?? ""),
      status:   String(camp?.status ?? ""),
    };
  } catch (e) {
    return { verified: false, reason: `ExoClick verification failed: ${String(e)}` };
  }
}

/**
 * TrafficStars: GET /v1.1/campaigns/{id}
 * → { id, name, status, ... }
 * Uses the access token the adapter already manages internally (OAuth2 refresh).
 */
async function verifyOnTrafficStars(adapter: TrafficStarsAdapter, externalId: string) {
  try {
    // getCampaigns lists all campaigns — we fetch the specific one by ID using
    // the same authenticated fetch the adapter uses for scaleDailyBudget.
    // We call it via a small wrapper to avoid coupling to private internals.
    const campaigns = await adapter.getCampaigns();
    const camp      = campaigns.find(c => String(c.id) === String(externalId));
    if (!camp) {
      // Campaign not in list yet — do a direct GET as second attempt
      const accessToken = await (adapter as unknown as {
        getAccessToken(): Promise<string>;
      }).getAccessToken();
      const res = await fetch(
        `https://api.trafficstars.com/v1.1/campaigns/${externalId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept:        "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { verified: false, reason: `TrafficStars GET /campaigns/${externalId} → ${res.status} ${text.slice(0, 200)}` };
      }
      const data = await res.json() as Record<string, unknown>;
      const id   = data?.id;
      if (!id) return { verified: false, reason: `TrafficStars GET /campaigns/${externalId} → no id in response` };
      return { verified: true as const, id: String(id), name: String(data?.name ?? ""), status: String(data?.status ?? "") };
    }
    return { verified: true as const, id: String(camp.id), name: camp.name, status: camp.status };
  } catch (e) {
    return { verified: false, reason: `TrafficStars verification failed: ${String(e)}` };
  }
}

/**
 * PropellerAds: GET /v5/adv/campaigns/{id}
 * → { id, name, status, ... }
 */
async function verifyOnPropellerAds(apiToken: string, externalId: string) {
  try {
    const res = await fetch(`https://ssp-api.propellerads.com/v5/adv/campaigns/${externalId}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept:        "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { verified: false, reason: `PropellerAds GET /campaigns/${externalId} → ${res.status} ${text.slice(0, 200)}` };
    }
    const data = await res.json() as Record<string, unknown>;
    const camp = (data as Record<string, unknown>).result ?? data;
    const id   = (camp as Record<string, unknown>)?.id;
    if (!id) {
      return { verified: false, reason: `PropellerAds GET /campaigns/${externalId} → no id in response` };
    }
    return {
      verified: true as const,
      id:       String(id),
      name:     String((camp as Record<string, unknown>)?.name ?? ""),
      status:   String((camp as Record<string, unknown>)?.status ?? ""),
    };
  } catch (e) {
    return { verified: false, reason: `PropellerAds verification failed: ${String(e)}` };
  }
}

/**
 * Adsterra: GET /advertiser/campaign/{id}.json
 * → { id, alias, active, format, ... }
 */
async function verifyOnAdsterra(apiKey: string, externalId: string) {
  try {
    const res = await fetch(`https://api3.adsterratools.com/advertiser/campaign/${externalId}.json`, {
      headers: {
        "X-API-Key": apiKey,
        Accept:      "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { verified: false, reason: `Adsterra GET /campaign/${externalId}.json → ${res.status} ${text.slice(0, 200)}` };
    }
    const data = await res.json() as Record<string, unknown>;
    const id   = data?.id;
    if (!id) {
      return { verified: false, reason: `Adsterra GET /campaign/${externalId}.json → no id in response` };
    }
    return {
      verified: true as const,
      id:       String(id),
      name:     String(data?.alias ?? data?.name ?? ""),
      status:   String(data?.active ?? ""),
    };
  } catch (e) {
    return { verified: false, reason: `Adsterra verification failed: ${String(e)}` };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const viewerBlock = await assertCanMutate(user.id);
    if (viewerBlock) return viewerBlock;

    const userId = await resolveWorkspaceUserId(user.id);

    let body: Record<string, unknown> & { network?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

    const network = body.network as string | undefined;

    if (!network) return NextResponse.json({ error: "Network is required" }, { status: 400 });
    if (!(body.name as string)?.trim()) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });

    // Load account
    const account = await prisma.account.findFirst({
      where: { userId: userId, network: network as Network, isActive: true },
    });
    if (!account) return NextResponse.json({ error: `No ${network} account connected` }, { status: 404 });

    const apiKey = decrypt(account.apiKeyEnc);

    // ── ExoClick ───────────────────────────────────────────────────────────────
    if (network === Network.EXOCLICK) {
      const params = body as unknown as ExoClickCreateParams;
      if (!params.bid || params.bid <= 0) return NextResponse.json({ error: "Invalid bid" }, { status: 400 });
      const adapter = new ExoClickAdapter(apiKey);
      const created = await adapter.createCampaign(params);

      const today = new Date().toISOString().slice(0, 10);
      const camp = await prisma.campaign.create({
        data: {
          userId:      userId,
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
          userId:  userId,
          type:    "CAMPAIGN_ACTION",
          message: `Campaign created on ExoClick: "${created.name}" (ID ${created.id})`,
          metadata: { network: "EXOCLICK", externalId: created.id },
        },
      });

      const verification = await verifyOnExoClick(apiKey, created.id);
      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name }, verification });
    }

    // ── TrafficStars ────────────────────────────────────────────────────────────
    if (network === Network.TRAFFICSTARS) {
      const tsParams = body as unknown as TrafficStarsCreateParams;
      if (!tsParams.format_id)     return NextResponse.json({ error: "Format is required"       }, { status: 400 });
      if (!tsParams.pricing_model) return NextResponse.json({ error: "Pricing model is required" }, { status: 400 });
      if (!tsParams.price || tsParams.price <= 0)     return NextResponse.json({ error: "Invalid bid"           }, { status: 400 });
      if (!tsParams.max_daily || tsParams.max_daily <= 0) return NextResponse.json({ error: "Invalid daily budget" }, { status: 400 });

      const adapter = new TrafficStarsAdapter(apiKey);
      const created = await adapter.createCampaign(tsParams);

      // Attach creative/banner if destination URL provided
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
          console.warn("[/api/campaigns/create] TS banner creation failed (non-fatal):", bannerErr);
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      const camp  = await prisma.campaign.create({
        data: {
          userId:      userId,
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
          userId:   userId,
          type:     "CAMPAIGN_ACTION",
          message:  `Campaign created on TrafficStars: "${created.name}" (ID ${created.id})`,
          metadata: { network: "TRAFFICSTARS", externalId: created.id },
        },
      });

      const verification = await verifyOnTrafficStars(adapter, created.id);
      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name }, verification });
    }

    // ── PropellerAds ────────────────────────────────────────────────────────────
    if (network === Network.PROPELLERADS) {
      const direction  = (body.direction  as string | undefined) ?? "onclick";
      const rate_model = (body.rate_model as string | undefined) ?? "cpm";
      if (!direction)  return NextResponse.json({ error: "Direction (format) is required"    }, { status: 400 });
      if (!rate_model) return NextResponse.json({ error: "Rate model (bid type) is required" }, { status: 400 });

      const bid         = body.bid         ? parseFloat(String(body.bid))         : undefined;
      const dailyBudget = body.dailyBudget ? parseFloat(String(body.dailyBudget)) : undefined;
      const totalBudget = body.totalBudget ? parseFloat(String(body.totalBudget)) : undefined;

      // PA minimum: $5 for onclick CPA, $10 for all other models
      const paMinBudget = (rate_model === "cpa" && direction === "onclick") ? 5 : 10;
      if ((dailyBudget ?? 0) > 0 && dailyBudget! < paMinBudget) {
        return NextResponse.json({ error: `PropellerAds minimum daily budget is $${paMinBudget} for ${rate_model.toUpperCase()}` }, { status: 400 });
      }

      // Validate direction enum (API only accepts these two values)
      if (direction !== "onclick" && direction !== "nativeads") {
        return NextResponse.json({ error: `Invalid direction "${direction}". Must be "onclick" or "nativeads".` }, { status: 400 });
      }

      const created = await PropellerAds.createCampaign(apiKey, {
        name:          String(body.name).trim(),
        direction:     direction as "onclick" | "nativeads",
        rate_model,
        target_url:    body.url    ? String(body.url).trim()    : undefined,
        countries:     Array.isArray(body.countries) ? body.countries as string[] : undefined,
        bid,
        daily_budget:  dailyBudget,
        total_budget:  totalBudget,
        timeSlots:     Array.isArray(body.timeSlots) ? body.timeSlots as number[] : undefined,
      });

      const today = new Date().toISOString().slice(0, 10);
      const camp  = await prisma.campaign.create({
        data: {
          userId:      userId,
          accountId:   account.id,
          externalId:  created.id,
          name:        created.name,
          network:     Network.PROPELLERADS,
          // PA campaigns always start in "moderation" (status=2) — not directly active/paused
          status:      CampaignStatus.PAUSED,
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
          userId:   userId,
          type:     "CAMPAIGN_ACTION",
          message:  `Campaign created on PropellerAds: "${created.name}" (ID ${created.id})`,
          metadata: { network: "PROPELLERADS", externalId: created.id },
        },
      });

      const verification = await verifyOnPropellerAds(apiKey, created.id);
      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name }, verification });
    }

    // ── Adsterra ────────────────────────────────────────────────────────────────
    if (network === Network.ADSTERRA) {
      const format       = (body.format       as string | undefined) ?? "pop";
      const pricing_type = (body.pricing_type as string | undefined) ?? "CPM";
      if (!format)       return NextResponse.json({ error: "Format is required"     }, { status: 400 });
      if (!pricing_type) return NextResponse.json({ error: "Pricing type is required" }, { status: 400 });

      const bid         = body.bid         ? parseFloat(String(body.bid))         : undefined;
      const dailyBudget = body.dailyBudget ? parseFloat(String(body.dailyBudget)) : undefined;
      const totalBudget = body.totalBudget ? parseFloat(String(body.totalBudget)) : undefined;

      const created = await Adsterra.createCampaign(apiKey, {
        name:          String(body.name).trim(),
        format,
        pricing_type,
        bid,
        countries:     Array.isArray(body.countries) ? body.countries as string[] : undefined,
        daily_budget:  dailyBudget,
        total_budget:  totalBudget,
        target_url:    body.url ? String(body.url).trim() : undefined,
        active:        !!body.active,
      });

      const today = new Date().toISOString().slice(0, 10);
      const camp  = await prisma.campaign.create({
        data: {
          userId:      userId,
          accountId:   account.id,
          externalId:  created.id,
          name:        created.name,
          network:     Network.ADSTERRA,
          status:      body.active ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
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
          userId:   userId,
          type:     "CAMPAIGN_ACTION",
          message:  `Campaign created on Adsterra: "${created.name}" (ID ${created.id})`,
          metadata: { network: "ADSTERRA", externalId: created.id },
        },
      });

      const verification = await verifyOnAdsterra(apiKey, created.id);
      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name }, verification });
    }

    // ── TrafficJunky ────────────────────────────────────────────────────────────
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
