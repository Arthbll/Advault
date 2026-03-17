import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Network, CampaignStatus } from "@prisma/client";

// Fake campaigns with different profiles
const FAKE_CAMPAIGNS = [
  { id: "fake-001", name: "Push Adult US — Tier1", baseSpend: 85,  baseRevenue: 110, volatility: 0.35 },
  { id: "fake-002", name: "Popunder BR/MX — RON",  baseSpend: 42,  baseRevenue: 50,  volatility: 0.55 },
  { id: "fake-003", name: "Native DE/FR — Dating", baseSpend: 130, baseRevenue: 145, volatility: 0.25 },
  { id: "fake-004", name: "Banner IN/PH — Gaming", baseSpend: 28,  baseRevenue: 22,  volatility: 0.60 }, // mostly losing
  { id: "fake-005", name: "Push US — Nutra",       baseSpend: 200, baseRevenue: 265, volatility: 0.40 },
];

function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function POST() {
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find any existing account or use a fake accountId
  const account = await prisma.account.findFirst({
    where: { userId: user.id },
  });
  if (!account) return NextResponse.json({ error: "No account found — connect an ad network first." }, { status: 400 });

  let inserted = 0;
  const days = 30;

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setUTCHours(0, 0, 0, 0);
    const dayStr = date.toISOString().slice(0, 10);

    for (const camp of FAKE_CAMPAIGNS) {
      const seed = parseInt(dayStr.replace(/-/g, "")) + parseInt(camp.id.replace("fake-", "")) * 137;

      const r1 = seededRand(seed);
      const r2 = seededRand(seed + 1);
      const r3 = seededRand(seed + 2);

      // Some days have no activity (~15% chance)
      if (r1 < 0.15) continue;

      const variance = 1 + (r2 - 0.5) * 2 * camp.volatility;
      const spend    = Math.max(0, camp.baseSpend  * variance * (0.7 + r3 * 0.6));
      const revenue  = Math.max(0, camp.baseRevenue * (1 + (r2 - 0.5) * 2 * camp.volatility) * (0.7 + seededRand(seed + 3) * 0.6));
      const impressions = Math.round(spend * 1200 + seededRand(seed + 4) * 50000);
      const clicks      = Math.round(impressions * (0.008 + seededRand(seed + 5) * 0.012));
      const conversions = Math.round(clicks * (0.02 + seededRand(seed + 6) * 0.04));

      await prisma.campaign.upsert({
        where: {
          accountId_externalId_dateFrom_dateTo: {
            accountId:  account.id,
            externalId: camp.id,
            dateFrom:   date,
            dateTo:     date,
          },
        },
        create: {
          userId:      user.id,
          accountId:   account.id,
          externalId:  camp.id,
          name:        camp.name,
          network:     Network.EXOCLICK,
          status:      CampaignStatus.ACTIVE,
          spend:       parseFloat(spend.toFixed(2)),
          revenue:     parseFloat(revenue.toFixed(2)),
          impressions,
          clicks,
          conversions,
          dateFrom:    date,
          dateTo:      date,
          syncedAt:    new Date(),
        },
        update: {
          spend:       parseFloat(spend.toFixed(2)),
          revenue:     parseFloat(revenue.toFixed(2)),
          impressions,
          clicks,
          conversions,
          syncedAt:    new Date(),
        },
      });
      inserted++;
    }
  }

  return NextResponse.json({ ok: true, inserted, days, campaigns: FAKE_CAMPAIGNS.length });
}

// DELETE — wipe all fake records
export async function DELETE() {
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await prisma.campaign.deleteMany({
    where: {
      userId: user.id,
      externalId: { in: FAKE_CAMPAIGNS.map(c => c.id) },
    },
  });

  return NextResponse.json({ ok: true, deleted: count });
}
