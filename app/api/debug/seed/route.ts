import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Network, CampaignStatus } from "@prisma/client";

const FAKE_CAMPAIGNS: {
  id: string; name: string; network: Network;
  baseSpend: number; baseRevenue: number; volatility: number;
  status?: CampaignStatus;
}[] = [
  // ExoClick
  { id: "fake-exo-001", name: "Push Adult US — Tier1",     network: Network.EXOCLICK,     baseSpend: 85,  baseRevenue: 110, volatility: 0.35 },
  { id: "fake-exo-002", name: "Popunder BR/MX — RON",      network: Network.EXOCLICK,     baseSpend: 42,  baseRevenue: 50,  volatility: 0.55 },
  { id: "fake-exo-003", name: "Native DE/FR — Dating",     network: Network.EXOCLICK,     baseSpend: 130, baseRevenue: 145, volatility: 0.25 },
  { id: "fake-exo-004", name: "Banner IN/PH — Gaming",     network: Network.EXOCLICK,     baseSpend: 28,  baseRevenue: 22,  volatility: 0.60, status: CampaignStatus.PAUSED },
  { id: "fake-exo-005", name: "Push US — Nutra",           network: Network.EXOCLICK,     baseSpend: 200, baseRevenue: 265, volatility: 0.40 },
  // TrafficStars
  { id: "fake-ts-001",  name: "Video Pre-roll EU — Adult", network: Network.TRAFFICSTARS, baseSpend: 95,  baseRevenue: 125, volatility: 0.30 },
  { id: "fake-ts-002",  name: "Banner US — Casino",        network: Network.TRAFFICSTARS, baseSpend: 180, baseRevenue: 210, volatility: 0.20 },
  { id: "fake-ts-003",  name: "Interstitial Latam — Cam",  network: Network.TRAFFICSTARS, baseSpend: 55,  baseRevenue: 48,  volatility: 0.65, status: CampaignStatus.PAUSED },
  // TrafficJunky
  { id: "fake-tj-001",  name: "Display US — Adult Dating", network: Network.TRAFFICJUNKY, baseSpend: 110, baseRevenue: 150, volatility: 0.28 },
  { id: "fake-tj-002",  name: "Sidebar CA — Nutra",        network: Network.TRAFFICJUNKY, baseSpend: 70,  baseRevenue: 82,  volatility: 0.45 },
  { id: "fake-tj-003",  name: "Banner EU — Gaming",        network: Network.TRAFFICJUNKY, baseSpend: 45,  baseRevenue: 38,  volatility: 0.70, status: CampaignStatus.PAUSED },
];

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function POST() {
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  if (accounts.length === 0) {
    return NextResponse.json({ error: "Connecte au moins un réseau dans Settings d'abord." }, { status: 400 });
  }

  const fallback = accounts[0];
  const byNet: Partial<Record<Network, string>> = {};
  for (const net of [Network.EXOCLICK, Network.TRAFFICSTARS, Network.TRAFFICJUNKY]) {
    byNet[net] = accounts.find(a => a.network === net)?.id ?? fallback.id;
  }

  let inserted = 0;
  const DAYS = 30;

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setUTCHours(0, 0, 0, 0);
    const dayStr = date.toISOString().slice(0, 10);

    for (const camp of FAKE_CAMPAIGNS) {
      const seed = parseInt(dayStr.replace(/-/g, "")) + parseInt(camp.id.replace(/\D/g, "").slice(0, 6)) * 137;
      const r1 = seededRand(seed);
      const r2 = seededRand(seed + 1);
      const r3 = seededRand(seed + 2);

      if (r1 < 0.15) continue;
      if (camp.status === CampaignStatus.PAUSED && d < 15) continue;

      const variance    = 1 + (r2 - 0.5) * 2 * camp.volatility;
      const spend       = Math.max(0, camp.baseSpend   * variance * (0.7 + r3 * 0.6));
      const revenue     = Math.max(0, camp.baseRevenue * (1 + (r2 - 0.5) * 2 * camp.volatility) * (0.7 + seededRand(seed + 3) * 0.6));
      const impressions = Math.round(spend * 1200 + seededRand(seed + 4) * 50000);
      const clicks      = Math.round(impressions * (0.008 + seededRand(seed + 5) * 0.012));
      const conversions = Math.round(clicks * (0.02 + seededRand(seed + 6) * 0.04));

      await prisma.campaign.upsert({
        where: { accountId_externalId_dateFrom_dateTo: { accountId: byNet[camp.network]!, externalId: camp.id, dateFrom: date, dateTo: date } },
        create: { userId: user.id, accountId: byNet[camp.network]!, externalId: camp.id, name: camp.name, network: camp.network, status: camp.status ?? CampaignStatus.ACTIVE, spend: parseFloat(spend.toFixed(2)), revenue: parseFloat(revenue.toFixed(2)), impressions, clicks, conversions, dateFrom: date, dateTo: date, syncedAt: new Date() },
        update: { name: camp.name, status: camp.status ?? CampaignStatus.ACTIVE, spend: parseFloat(spend.toFixed(2)), revenue: parseFloat(revenue.toFixed(2)), impressions, clicks, conversions, syncedAt: new Date() },
      });
      inserted++;
    }
  }

  await prisma.log.create({ data: { userId: user.id, type: "SYNC", message: `[SEED] ${inserted} entrées fictives (${FAKE_CAMPAIGNS.length} campagnes × 3 réseaux)`, metadata: { inserted } } });
  return NextResponse.json({ ok: true, inserted, campaigns: FAKE_CAMPAIGNS.length, networks: { EXOCLICK: 5, TRAFFICSTARS: 3, TRAFFICJUNKY: 3 } });
}

export async function DELETE() {
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await prisma.campaign.deleteMany({ where: { userId: user.id, externalId: { startsWith: "fake-" } } });
  return NextResponse.json({ ok: true, deleted: count });
}
