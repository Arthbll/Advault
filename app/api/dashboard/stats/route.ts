import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : parseFloat(d.toString());
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo   = searchParams.get("dateTo")   ?? new Date().toISOString().slice(0, 10);

  // Sum all daily records within the date range
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId:   user.id,
      dateFrom: { gte: new Date(dateFrom) },
      dateTo:   { lte: new Date(dateTo + "T23:59:59Z") },
    },
  });

  const totalSpend   = campaigns.reduce((s, c) => s + toNum(c.spend),   0);
  const totalRevenue = campaigns.reduce((s, c) => s + toNum(c.revenue), 0);
  const totalProfit  = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;
  const totalImps    = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks  = campaigns.reduce((s, c) => s + c.clicks,      0);
  const totalConvs   = campaigns.reduce((s, c) => s + c.conversions, 0);
  const ctr          = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;

  // Chart by day
  const byDate = new Map<string, { spend: number; revenue: number }>();
  for (const c of campaigns) {
    const key = c.dateFrom.toISOString().slice(0, 10);
    const cur = byDate.get(key) ?? { spend: 0, revenue: 0 };
    byDate.set(key, { spend: cur.spend + toNum(c.spend), revenue: cur.revenue + toNum(c.revenue) });
  }
  const chartData = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { spend, revenue }]) => {
      const [, m, d] = date.split("-");
      return { date: `${d}/${m}`, spend, revenue, profit: revenue - spend };
    });

  // Per-network
  const netMap = new Map<string, { spend: number; revenue: number; campaigns: number }>();
  for (const c of campaigns) {
    const cur = netMap.get(c.network) ?? { spend: 0, revenue: 0, campaigns: 0 };
    netMap.set(c.network, { spend: cur.spend + toNum(c.spend), revenue: cur.revenue + toNum(c.revenue), campaigns: cur.campaigns + 1 });
  }

  return NextResponse.json({
    totals: { totalSpend, totalRevenue, totalProfit, roi, totalImps, totalClicks, totalConvs, ctr },
    chartData,
    networkBreakdown: Array.from(netMap.entries()).map(([network, s]) => ({
      network, ...s,
      profit: s.revenue - s.spend,
      roi: s.spend > 0 ? ((s.revenue - s.spend) / s.spend) * 100 : 0,
    })),
    activeCampaigns: new Set(campaigns.filter(c => c.status === "ACTIVE").map(c => c.externalId)).size,
  });
}
