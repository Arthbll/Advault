import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";
import BentoDashboard from "@/components/dashboard/BentoDashboard";
import { ChartPoint } from "@/components/dashboard/ProfitChart";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : parseFloat(d.toString());
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function iso30DaysAgo(): string {
  return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getDashboardData(userId: string, dateFrom: string, dateTo: string) {
  // Sum all daily records within the date range
  const campaigns = await prisma.campaign.findMany({
    where: {
      userId,
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

  // Chart — group by day
  const byDate = new Map<string, { spend: number; revenue: number }>();
  for (const c of campaigns) {
    const key = c.dateFrom.toISOString().slice(0, 10);
    const cur = byDate.get(key) ?? { spend: 0, revenue: 0 };
    byDate.set(key, {
      spend:   cur.spend   + toNum(c.spend),
      revenue: cur.revenue + toNum(c.revenue),
    });
  }
  const chartData: ChartPoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { spend, revenue }]) => {
      const [, m, d] = date.split("-");
      return {
        date:    `${d}/${m}`,
        spend:   Math.round(spend * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        profit:  Math.round((revenue - spend) * 100) / 100,
      };
    });

  // Per-network breakdown
  const netMap = new Map<string, { spend: number; revenue: number; campaigns: number; impressions: number }>();
  for (const c of campaigns) {
    const cur = netMap.get(c.network) ?? { spend: 0, revenue: 0, campaigns: 0, impressions: 0 };
    netMap.set(c.network, {
      spend:       cur.spend       + toNum(c.spend),
      revenue:     cur.revenue     + toNum(c.revenue),
      campaigns:   cur.campaigns   + 1,
      impressions: cur.impressions + c.impressions,
    });
  }

  return {
    totals: { totalSpend, totalRevenue, totalProfit, roi, totalImps, totalClicks, totalConvs, ctr },
    chartData,
    networkBreakdown: Array.from(netMap.entries()).map(([network, stats]) => ({
      network, ...stats,
      profit: stats.revenue - stats.spend,
      roi: stats.spend > 0 ? ((stats.revenue - stats.spend) / stats.spend) * 100 : 0,
    })),
    activeCampaigns: new Set(campaigns.filter(c => c.status === "ACTIVE").map(c => c.externalId)).size,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dateFrom = iso30DaysAgo();
  const dateTo   = isoToday();
  const { totals, chartData, networkBreakdown, activeCampaigns } =
    await getDashboardData(user.id, dateFrom, dateTo);

  return (
    <BentoDashboard
      totals={totals}
      chartData={chartData}
      networkBreakdown={networkBreakdown}
      activeCampaigns={activeCampaigns}
      profitLabel={fmtEuro(totals.totalProfit)}
      roiLabel={fmtPct(totals.roi)}
      spendLabel={fmtEuro(totals.totalSpend)}
      convLabel={totals.totalConvs.toLocaleString("fr-FR")}
      spendSub={`${fmtEuro(totals.totalRevenue)} revenus − ${fmtEuro(totals.totalSpend)} dépenses`}
      convSub={`CTR ${totals.ctr.toFixed(2)}% · ${totals.totalClicks.toLocaleString("fr-FR")} clics`}
    />
  );
}
