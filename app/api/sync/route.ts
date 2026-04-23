import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter }    from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter } from "@/lib/adapters/trafficjunky";
import * as PropellerAds       from "@/lib/adapters/propellerads";
import * as Adsterra           from "@/lib/adapters/adsterra";
import { Network, CampaignStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { resolveWorkspaceUserId } from "@/lib/workspace";

// Allow up to 5 min on Vercel (backfill = 90 days × 1.5s ≈ 135s)
export const maxDuration = 300;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveWorkspaceUserId(user.id);

  // mode=backfill → sync last 90 days day by day (first-time setup)
  // mode=daily    → sync only today (default, called by cron/manual)
  // network       → restrict sync to a single network (e.g. "ADSTERRA")
  const body = await req.json().catch(() => ({})) as { mode?: string; network?: string };
  const isBackfill = body?.mode === "backfill";
  const networkFilter = body?.network?.toUpperCase() ?? null;

  // Build list of days to sync
  const today = todayStr();
  const daysToSync: string[] = isBackfill
    ? Array.from({ length: 90 }, (_, i) => daysAgoStr(89 - i)) // oldest → newest
    : [today];

  // 2. Load user's active accounts (optionally filter to one network)
  const accounts = await prisma.account.findMany({
    where: {
      userId: userId,
      isActive: true,
      ...(networkFilter ? { network: networkFilter as Network } : {}),
    },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ synced: 0, skipped: true, message: "No connected accounts." });
  }

  let totalSynced = 0;
  const errors: string[] = [];

  // ── Snapshot des campagnes KILLED avant le sync ────────────────────────────
  // Le sync écrase le statut depuis les APIs réseau, ce qui remettrait les
  // campagnes tuées en ACTIVE. On les snapshote ici et on les restaure après.
  const killedBefore = await prisma.campaign.findMany({
    where:  { userId: userId, status: CampaignStatus.KILLED },
    select: { externalId: true },
    distinct: ["externalId"],
  });
  const killedExternalIds = killedBefore.map(c => c.externalId);

  // On backfill: delete old "range" records (dateFrom ≠ dateTo) that were
  // created before the daily-sync format — they inflate totals when mixed
  // with the new per-day records.
  if (isBackfill) {
    await prisma.$executeRaw`
      DELETE FROM "Campaign"
      WHERE "userId" = ${userId}
        AND "dateFrom" != "dateTo"
    `;
  }

  for (const account of accounts) {
    try {
      const apiKey = decrypt(account.apiKeyEnc);

      if (account.network === Network.EXOCLICK) {
        const adapter   = new ExoClickAdapter(apiKey);
        const campaigns = await adapter.getCampaigns();

        if (isBackfill) {
          // ── BACKFILL: 1 seul appel API pour toute la plage (90 jours) ──────
          // Utilise group_by=["campaign_id","date"] pour avoir les données par jour
          // en un seul round-trip au lieu de 90 appels séparés.
          const bulkStats = await adapter.getStatsBulk(daysToSync[0], daysToSync[daysToSync.length - 1]);

          // Index par (campaignId, date)
          const statsMap = new Map<string, typeof bulkStats[0]>();
          for (const s of bulkStats) {
            statsMap.set(`${s.campaignId}::${s.dateFrom}`, s);
          }

          for (const day of daysToSync) {
            for (const campaign of campaigns) {
              const stat = statsMap.get(`${campaign.id}::${day}`) ?? statsMap.get(`${Number(campaign.id)}::${day}`);
              await prisma.campaign.upsert({
                where: {
                  accountId_externalId_dateFrom_dateTo: {
                    accountId:  account.id,
                    externalId: String(campaign.id),
                    dateFrom:   new Date(day),
                    dateTo:     new Date(day),
                  },
                },
                create: {
                  userId:      userId,
                  accountId:   account.id,
                  externalId:  String(campaign.id),
                  name:        campaign.name,
                  network:     Network.EXOCLICK,
                  status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     stat?.revenue     ?? 0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  dateFrom:    new Date(day),
                  dateTo:      new Date(day),
                  syncedAt:    new Date(),
                },
                update: {
                  name:        campaign.name,
                  status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     stat?.revenue     ?? 0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  syncedAt:    new Date(),
                },
              });
              totalSynced++;
            }
          }
        } else {
          // ── DAILY: 1 appel par jour (mode normal) ───────────────────────────
          for (const day of daysToSync) {
            try {
              const stats = await adapter.getStats(day, day);
              const statsMap: Record<string, typeof stats[0]> = {};
              for (const s of stats) {
                statsMap[String(s.campaignId)] = s;
                statsMap[String(Number(s.campaignId))] = s;
              }

              for (const campaign of campaigns) {
                const stat = statsMap[String(campaign.id)] ?? statsMap[String(Number(campaign.id))];
                await prisma.campaign.upsert({
                  where: {
                    accountId_externalId_dateFrom_dateTo: {
                      accountId:  account.id,
                      externalId: String(campaign.id),
                      dateFrom:   new Date(day),
                      dateTo:     new Date(day),
                    },
                  },
                  create: {
                    userId:      userId,
                    accountId:   account.id,
                    externalId:  String(campaign.id),
                    name:        campaign.name,
                    network:     Network.EXOCLICK,
                    status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                    spend:       stat?.spent       ?? 0,
                    revenue:     stat?.revenue     ?? 0,
                    impressions: stat?.impressions ?? 0,
                    clicks:      stat?.clicks      ?? 0,
                    conversions: stat?.conversions ?? 0,
                    dateFrom:    new Date(day),
                    dateTo:      new Date(day),
                    syncedAt:    new Date(),
                  },
                  update: {
                    name:        campaign.name,
                    status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                    spend:       stat?.spent       ?? 0,
                    revenue:     stat?.revenue     ?? 0,
                    impressions: stat?.impressions ?? 0,
                    clicks:      stat?.clicks      ?? 0,
                    conversions: stat?.conversions ?? 0,
                    syncedAt:    new Date(),
                  },
                });
                totalSynced++;
              }
            } catch (dayErr) {
              const msg = dayErr instanceof Error ? dayErr.message : String(dayErr);
              errors.push(`EXOCLICK day ${day}: ${msg}`);
            }
          }
        }

        await prisma.log.create({
          data: {
            userId:   userId,
            type:     "SYNC",
            message:  `ExoClick sync: ${campaigns.length} campagnes × ${daysToSync.length} jour(s)`,
            metadata: { network: "EXOCLICK", campaigns: campaigns.length, days: daysToSync.length, mode: isBackfill ? "backfill" : "daily" },
          },
        });
      }

      if (account.network === Network.TRAFFICSTARS) {
        const adapter   = new TrafficStarsAdapter(apiKey);
        const campaigns = await adapter.getCampaigns();

        for (let di = 0; di < daysToSync.length; di++) {
          const day = daysToSync[di];
          // Rate-limit: sleep 400ms between days on backfill to avoid TS API throttling
          if (isBackfill && di > 0) await sleep(400);
          try {
            const stats = await adapter.getStats(day, day);
            const statsMap: Record<string, typeof stats[0]> = {};
            for (const s of stats) {
              statsMap[String(s.campaignId)] = s;
              statsMap[String(Number(s.campaignId))] = s;
            }

            for (const campaign of campaigns) {
              const stat = statsMap[String(campaign.id)] ?? statsMap[String(Number(campaign.id))];
              await prisma.campaign.upsert({
                where: {
                  accountId_externalId_dateFrom_dateTo: {
                    accountId:  account.id,
                    externalId: String(campaign.id),
                    dateFrom:   new Date(day),
                    dateTo:     new Date(day),
                  },
                },
                create: {
                  userId:      userId,
                  accountId:   account.id,
                  externalId:  String(campaign.id),
                  name:        campaign.name,
                  network:     Network.TRAFFICSTARS,
                  status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  dateFrom:    new Date(day),
                  dateTo:      new Date(day),
                  syncedAt:    new Date(),
                },
                update: {
                  name:        campaign.name,
                  status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  syncedAt:    new Date(),
                },
              });
              totalSynced++;
            }
          } catch (dayErr) {
            const msg = dayErr instanceof Error ? dayErr.message : String(dayErr);
            errors.push(`TRAFFICSTARS day ${day}: ${msg}`);
          }
        }

        await prisma.log.create({
          data: {
            userId:   userId,
            type:     "SYNC",
            message:  `TrafficStars sync: ${campaigns.length} campagnes × ${daysToSync.length} jour(s)`,
            metadata: { network: "TRAFFICSTARS", campaigns: campaigns.length, days: daysToSync.length, mode: isBackfill ? "backfill" : "daily" },
          },
        });
      }

      if (account.network === Network.TRAFFICJUNKY) {
        const adapter   = new TrafficJunkyAdapter(apiKey);
        const campaigns = await adapter.getCampaigns();

        for (let di = 0; di < daysToSync.length; di++) {
          const day = daysToSync[di];
          // Rate-limit: sleep 400ms between days on backfill to avoid TJ API throttling
          if (isBackfill && di > 0) await sleep(400);
          try {
            const stats = await adapter.getStats(day, day);
            const statsMap: Record<string, typeof stats[0]> = {};
            for (const s of stats) {
              statsMap[String(s.campaignId)] = s;
            }

            for (const campaign of campaigns) {
              // TJ uses campaign_id / campaign_name (not id / name)
              const extId = String(campaign.campaign_id);
              const stat  = statsMap[extId];
              await prisma.campaign.upsert({
                where: {
                  accountId_externalId_dateFrom_dateTo: {
                    accountId:  account.id,
                    externalId: extId,
                    dateFrom:   new Date(day),
                    dateTo:     new Date(day),
                  },
                },
                create: {
                  userId:      userId,
                  accountId:   account.id,
                  externalId:  extId,
                  name:        campaign.campaign_name,
                  network:     Network.TRAFFICJUNKY,
                  status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  dateFrom:    new Date(day),
                  dateTo:      new Date(day),
                  syncedAt:    new Date(),
                },
                update: {
                  name:        campaign.campaign_name,
                  status:      campaign.status === "active" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  syncedAt:    new Date(),
                },
              });
              totalSynced++;
            }
          } catch (dayErr) {
            const msg = dayErr instanceof Error ? dayErr.message : String(dayErr);
            errors.push(`TRAFFICJUNKY day ${day}: ${msg}`);
          }
        }

        await prisma.log.create({
          data: {
            userId:   userId,
            type:     "SYNC",
            message:  `TrafficJunky sync: ${campaigns.length} campagnes × ${daysToSync.length} jour(s)`,
            metadata: { network: "TRAFFICJUNKY", campaigns: campaigns.length, days: daysToSync.length, mode: isBackfill ? "backfill" : "daily" },
          },
        });
      }

      if (account.network === Network.PROPELLERADS) {
        const campaigns = await PropellerAds.getCampaigns(decrypt(account.apiKeyEnc));

        for (let di = 0; di < daysToSync.length; di++) {
          const day = daysToSync[di];
          if (isBackfill && di > 0) await sleep(300);
          try {
            const stats    = await PropellerAds.getCampaignStats(decrypt(account.apiKeyEnc), day, day);
            const statsMap: Record<string, typeof stats[0]> = {};
            for (const s of stats) statsMap[String(s.campaign_id)] = s;

            for (const campaign of campaigns) {
              const extId = String(campaign.id);
              const stat  = statsMap[extId];
              await prisma.campaign.upsert({
                where: {
                  accountId_externalId_dateFrom_dateTo: {
                    accountId:  account.id,
                    externalId: extId,
                    dateFrom:   new Date(day),
                    dateTo:     new Date(day),
                  },
                },
                create: {
                  userId:      userId,
                  accountId:   account.id,
                  externalId:  extId,
                  name:        campaign.title ?? campaign.name,
                  network:     Network.PROPELLERADS,
                  status:      PropellerAds.mapStatus(campaign.status) === "ACTIVE" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     stat?.revenue     ?? 0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  dateFrom:    new Date(day),
                  dateTo:      new Date(day),
                  syncedAt:    new Date(),
                },
                update: {
                  name:        campaign.title ?? campaign.name,
                  status:      PropellerAds.mapStatus(campaign.status) === "ACTIVE" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     stat?.revenue     ?? 0,
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  syncedAt:    new Date(),
                },
              });
              totalSynced++;
            }
          } catch (dayErr) {
            const msg = dayErr instanceof Error ? dayErr.message : String(dayErr);
            errors.push(`PROPELLERADS day ${day}: ${msg}`);
          }
        }

        await prisma.log.create({
          data: {
            userId:   userId,
            type:     "SYNC",
            message:  `PropellerAds sync: ${campaigns.length} campagnes × ${daysToSync.length} jour(s)`,
            metadata: { network: "PROPELLERADS", campaigns: campaigns.length, days: daysToSync.length, mode: isBackfill ? "backfill" : "daily" },
          },
        });
      }

      if (account.network === Network.ADSTERRA) {
        const campaigns = await Adsterra.getCampaigns(decrypt(account.apiKeyEnc));

        for (let di = 0; di < daysToSync.length; di++) {
          const day = daysToSync[di];
          if (isBackfill && di > 0) await sleep(300);
          try {
            const stats    = await Adsterra.getCampaignStats(decrypt(account.apiKeyEnc), day, day);
            const statsMap: Record<string, typeof stats[0]> = {};
            for (const s of stats) statsMap[String(s.campaign_id)] = s;

            for (const campaign of campaigns) {
              const extId = String(campaign.id);
              const stat  = statsMap[extId];
              await prisma.campaign.upsert({
                where: {
                  accountId_externalId_dateFrom_dateTo: {
                    accountId:  account.id,
                    externalId: extId,
                    dateFrom:   new Date(day),
                    dateTo:     new Date(day),
                  },
                },
                create: {
                  userId:      userId,
                  accountId:   account.id,
                  externalId:  extId,
                  name:        campaign.alias,
                  network:     Network.ADSTERRA,
                  status:      Adsterra.mapStatus(campaign.active) === "ACTIVE" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     0, // Adsterra stats API has no revenue field
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  dateFrom:    new Date(day),
                  dateTo:      new Date(day),
                  syncedAt:    new Date(),
                },
                update: {
                  name:        campaign.alias,
                  status:      Adsterra.mapStatus(campaign.active) === "ACTIVE" ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
                  spend:       stat?.spent       ?? 0,
                  revenue:     0, // Adsterra stats API has no revenue field
                  impressions: stat?.impressions ?? 0,
                  clicks:      stat?.clicks      ?? 0,
                  conversions: stat?.conversions ?? 0,
                  syncedAt:    new Date(),
                },
              });
              totalSynced++;
            }
          } catch (dayErr) {
            const msg = dayErr instanceof Error ? dayErr.message : String(dayErr);
            errors.push(`ADSTERRA day ${day}: ${msg}`);
          }
        }

        await prisma.log.create({
          data: {
            userId:   userId,
            type:     "SYNC",
            message:  `Adsterra sync: ${campaigns.length} campagnes × ${daysToSync.length} jour(s)`,
            metadata: { network: "ADSTERRA", campaigns: campaigns.length, days: daysToSync.length, mode: isBackfill ? "backfill" : "daily" },
          },
        });
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${account.network}: ${msg}`);
      await prisma.log.create({
        data: {
          userId:   userId,
          type:     "API_ERROR",
          message:  `Sync error ${account.network}: ${msg}`,
          metadata: { network: account.network },
        },
      }).catch(() => {});
    }
  }

  // ── Restaurer le statut KILLED après le sync ─────────────────────────────
  // Le sync écrase les statuts depuis les APIs réseau. On force KILLED sur
  // toutes les campagnes qui étaient KILLED avant le sync.
  if (killedExternalIds.length > 0) {
    await prisma.campaign.updateMany({
      where: { userId: userId, externalId: { in: killedExternalIds } },
      data:  { status: CampaignStatus.KILLED },
    });
  }

  return NextResponse.json({
    synced:  totalSynced,
    errors:  errors.length > 0 ? errors : undefined,
    days:    daysToSync.length,
    mode:    isBackfill ? "backfill" : "daily",
  });
}

/** GET — returns aggregated dashboard stats from DB (no external API call) */
export async function GET(req: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? daysAgoStr(90);
  const dateTo   = searchParams.get("dateTo")   ?? todayStr();

  const userId = await resolveWorkspaceUserId(user.id);

  // Vérifier si des comptes sont connectés
  const accountCount = await prisma.account.count({ where: { userId: userId, isActive: true } });

  const allCampaigns = await prisma.campaign.findMany({
    where: {
      userId:   userId,
      dateFrom: { lte: new Date(dateTo)   },
      dateTo:   { gte: new Date(dateFrom) },
    },
    orderBy: { syncedAt: "desc" },
  });

  // Dédoublonnage : garder uniquement la ligne la plus récente par (externalId + network)
  const seen = new Set<string>();
  const campaigns = allCampaigns.filter(c => {
    const key = `${c.network}:${c.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Aucune campagne synchronisée → état vide (pas de données fictives)
  if (campaigns.length === 0) {
    return NextResponse.json({
      kpis: { totalSpend: "0.00", totalRevenue: "0.00", profit: "0.00", roi: "0", totalImpressions: 0, totalClicks: 0 },
      byNetwork: {},
      syncErrors: [],
      dateFrom,
      dateTo,
      campaigns: [],
    });
  }

  // Also return recent sync errors from logs
  const recentErrors = await prisma.log.findMany({
    where: { userId: userId, type: "API_ERROR", createdAt: { gte: new Date(Date.now() - 3600_000) } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { message: true, createdAt: true },
  });

  // Aggregate
  const totalSpend   = campaigns.reduce((s, c) => s + Number(c.spend),       0);
  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue),      0);
  const totalImpr    = campaigns.reduce((s, c) => s + c.impressions,          0);
  const totalClicks  = campaigns.reduce((s, c) => s + c.clicks,               0);
  const profit       = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? ((profit / totalSpend) * 100).toFixed(1) : "0";

  // Per-network breakdown
  const byNetwork: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }> = {};
  for (const c of campaigns) {
    const k = c.network;
    if (!byNetwork[k]) byNetwork[k] = { spend: 0, revenue: 0, impressions: 0, clicks: 0 };
    byNetwork[k].spend       += Number(c.spend);
    byNetwork[k].revenue     += Number(c.revenue);
    byNetwork[k].impressions += c.impressions;
    byNetwork[k].clicks      += c.clicks;
  }

  return NextResponse.json({
    kpis: {
      totalSpend:   totalSpend.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      profit:       profit.toFixed(2),
      roi,
      totalImpressions: totalImpr,
      totalClicks,
    },
    byNetwork,
    syncErrors: recentErrors,
    dateFrom,
    dateTo,
    campaigns: campaigns.map(c => ({
      id:          c.id,
      externalId:  c.externalId,
      name:        c.name,
      network:     c.network,
      status:      c.status,
      spend:       Number(c.spend),
      revenue:     Number(c.revenue),
      impressions: c.impressions,
      clicks:      c.clicks,
      conversions: c.conversions,
      syncedAt:    c.syncedAt,
    })),
  });
}
