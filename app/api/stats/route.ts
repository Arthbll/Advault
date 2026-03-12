import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";
import { Network } from "@prisma/client";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? daysAgoStr(90);
  const dateTo   = searchParams.get("dateTo")   ?? todayStr();

  const accounts = await prisma.account.findMany({
    where: { userId: user.id, isActive: true },
  });

  // Get campaign names/statuses from DB
  const dbCampaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { syncedAt: "desc" },
  });
  // Deduplicate — keep latest per externalId+network
  const seen = new Set<string>();
  const latestCampaigns = dbCampaigns.filter(c => {
    const k = `${c.network}:${c.externalId}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  const campaignMeta: Record<string, { name: string; status: string; network: string }> = {};
  for (const c of latestCampaigns) {
    campaignMeta[`${c.network}:${c.externalId}`] = { name: c.name, status: c.status, network: c.network };
  }

  // Live stats per account for the exact date range
  type StatRow = { campaignId: string; name: string; network: string; status: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number };
  const rows: StatRow[] = [];
  const syncErrors: string[] = [];

  for (const account of accounts) {
    try {
      const apiKey = decrypt(account.apiKeyEnc);

      if (account.network === Network.EXOCLICK) {
        const adapter = new ExoClickAdapter(apiKey);
        const [campaigns, stats] = await Promise.all([
          adapter.getCampaigns(),
          adapter.getStats(dateFrom, dateTo),
        ]);
        const statsMap: Record<string, typeof stats[0]> = {};
        for (const s of stats) statsMap[String(s.campaignId)] = s;

        for (const c of campaigns) {
          const s = statsMap[String(c.id)];
          rows.push({
            campaignId:  String(c.id),
            name:        c.name,
            network:     "EXOCLICK",
            status:      c.status === "active" ? "ACTIVE" : "PAUSED",
            spend:       s?.spent       ?? 0,
            revenue:     s?.revenue     ?? 0,
            impressions: s?.impressions ?? 0,
            clicks:      s?.clicks      ?? 0,
            conversions: s?.conversions ?? 0,
          });
        }
      }

      if (account.network === Network.TRAFFICSTARS) {
        const adapter = new TrafficStarsAdapter(apiKey);
        const [campaigns, stats] = await Promise.all([
          adapter.getCampaigns(),
          adapter.getStats(dateFrom, dateTo),
        ]);
        const statsMap: Record<string, typeof stats[0]> = {};
        for (const s of stats) statsMap[String(s.campaignId)] = s;

        for (const c of campaigns) {
          const s = statsMap[String(c.id)];
          rows.push({
            campaignId:  String(c.id),
            name:        c.name,
            network:     "TRAFFICSTARS",
            status:      c.status === "active" ? "ACTIVE" : "PAUSED",
            spend:       s?.spent       ?? 0,
            revenue:     0,
            impressions: s?.impressions ?? 0,
            clicks:      s?.clicks      ?? 0,
            conversions: s?.conversions ?? 0,
          });
        }
      }
    } catch (err) {
      syncErrors.push(`${account.network}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Aggregate
  const totalSpend   = rows.reduce((s, r) => s + r.spend,       0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue,     0);
  const totalImpr    = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks  = rows.reduce((s, r) => s + r.clicks,      0);
  const profit       = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? ((profit / totalSpend) * 100).toFixed(1) : "0";

  const byNetwork: Record<string, { spend: number; revenue: number; impressions: number; clicks: number }> = {};
  for (const r of rows) {
    if (!byNetwork[r.network]) byNetwork[r.network] = { spend: 0, revenue: 0, impressions: 0, clicks: 0 };
    byNetwork[r.network].spend       += r.spend;
    byNetwork[r.network].revenue     += r.revenue;
    byNetwork[r.network].impressions += r.impressions;
    byNetwork[r.network].clicks      += r.clicks;
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
    syncErrors: syncErrors.map(m => ({ message: m, createdAt: new Date().toISOString() })),
    dateFrom,
    dateTo,
    campaigns: rows.map(r => ({
      id:          `${r.network}:${r.campaignId}`,
      externalId:  r.campaignId,
      name:        r.name,
      network:     r.network,
      status:      r.status,
      spend:       r.spend,
      revenue:     r.revenue,
      impressions: r.impressions,
      clicks:      r.clicks,
      conversions: r.conversions,
    })),
  });
}
