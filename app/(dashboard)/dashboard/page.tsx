import { prisma }        from "@/lib/prisma";
import { createClient }  from "@/lib/supabase/server";
import { redirect }      from "next/navigation";
import { cookies }       from "next/headers";

export const dynamic = "force-dynamic";
import { Decimal } from "@prisma/client/runtime/library";
import BentoDashboard from "@/components/dashboard/BentoDashboard";
import { ChartPoint } from "@/components/dashboard/ProfitChart";
import { AlertCampaign } from "@/components/dashboard/AlertBanner";
import { CampaignRow } from "@/components/dashboard/CampaignsPnL";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : parseFloat(d.toString());
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("en-GB", {
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

async function getDashboardData(userId: string, dateFrom: string, dateTo: string, forceDemo = false) {
  // ── Mode aperçu : activé manuellement depuis les Paramètres ───────────────
  if (forceDemo) {
    const { getDemoDashboardStatsResponse } = await import("@/lib/demo-data");
    return { ...getDemoDashboardStatsResponse(dateFrom, dateTo), needsSync: false };
  }

  // ── Vérifier si des comptes sont connectés ────────────────────────────────
  let accountCount = 0;
  try {
    accountCount = await prisma.account.count({ where: { userId, isActive: true } });
  } catch { /* DB unreachable — stay at 0 */ }

  // ── Current period ─────────────────────────────────────────────────────────
  let safeCampaigns: Awaited<ReturnType<typeof prisma.campaign.findMany>> = [];
  try {
    safeCampaigns = await prisma.campaign.findMany({
      where: {
        userId,
        dateFrom: { gte: new Date(dateFrom) },
        dateTo:   { lte: new Date(dateTo + "T23:59:59Z") },
      },
    });
  } catch { /* DB unreachable — empty campaigns */ }

  // No campaigns yet — return zero state (account connected, just no data synced yet)
  if (safeCampaigns.length === 0) {
    return {
      totals:           { totalSpend: 0, totalRevenue: 0, totalProfit: 0, roi: 0, totalImps: 0, totalClicks: 0, totalConvs: 0, ctr: 0, ctrNoPop: 0, clickImps: 0, clickClicks: 0, clickCtr: 0, popImps: 0, popConvs: 0, popConvRate: 0 },
      chartData:        [] as ChartPoint[],
      networkBreakdown: [] as { network: string; spend: number; revenue: number; campaigns: number; impressions: number; profit: number; roi: number }[],
      activeCampaigns:  0,
      alerts:           [] as AlertCampaign[],
      topCampaigns:     [] as CampaignRow[],
      trend:            null as number | null,
      needsSync:        true,
    };
  }

  const totalSpend   = safeCampaigns.reduce((s, c) => s + toNum(c.spend),   0);
  const totalRevenue = safeCampaigns.reduce((s, c) => s + toNum(c.revenue), 0);
  const totalProfit  = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;
  const totalImps    = safeCampaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks  = safeCampaigns.reduce((s, c) => s + c.clicks,      0);
  const totalConvs   = safeCampaigns.reduce((s, c) => s + c.conversions, 0);
  const ctr          = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;

  const nonPop      = safeCampaigns.filter(c => !/pop/i.test(c.name));
  const impsNoPop   = nonPop.reduce((s, c) => s + c.impressions, 0);
  const clicksNoPop = nonPop.reduce((s, c) => s + c.clicks, 0);
  const ctrNoPop    = impsNoPop > 0 ? (clicksNoPop / impsNoPop) * 100 : 0;

  // ── Format-split: campagnes clic vs. campagnes impression ─────────────────
  // Se base sur le champ `format` si disponible, sinon repli sur le nom.
  const popCmps     = safeCampaigns.filter(c => /pop/i.test((c as { format?: string }).format ?? c.name));
  const clickCmps   = safeCampaigns.filter(c => !/pop/i.test((c as { format?: string }).format ?? c.name));
  const clickImps   = clickCmps.reduce((s, c) => s + c.impressions, 0);
  const clickClicks = clickCmps.reduce((s, c) => s + c.clicks,      0);
  const clickCtr    = clickImps > 0 ? (clickClicks / clickImps) * 100 : 0;
  const popImps     = popCmps.reduce((s, c) => s + c.impressions, 0);
  const popConvs    = popCmps.reduce((s, c) => s + c.conversions, 0);
  const popConvRate = popImps > 0 ? (popConvs / popImps) * 100 : 0;

  // ── Chart by day ───────────────────────────────────────────────────────────
  const byDate = new Map<string, { spend: number; revenue: number }>();
  for (const c of safeCampaigns) {
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

  // ── Per-network ────────────────────────────────────────────────────────────
  const netMap = new Map<string, { spend: number; revenue: number; campaigns: number; impressions: number }>();
  for (const c of safeCampaigns) {
    const cur = netMap.get(c.network) ?? { spend: 0, revenue: 0, campaigns: 0, impressions: 0 };
    netMap.set(c.network, {
      spend:       cur.spend       + toNum(c.spend),
      revenue:     cur.revenue     + toNum(c.revenue),
      campaigns:   cur.campaigns   + 1,
      impressions: cur.impressions + c.impressions,
    });
  }

  // ── Per-campaign P&L ───────────────────────────────────────────────────────
  const campAgg = new Map<string, {
    id: string; name: string; network: string; status: string;
    spend: number; revenue: number;
  }>();
  for (const c of safeCampaigns) {
    const existing = campAgg.get(c.externalId);
    if (existing) {
      existing.spend   += toNum(c.spend);
      existing.revenue += toNum(c.revenue);
    } else {
      campAgg.set(c.externalId, {
        id:      c.id,
        name:    c.name,
        network: c.network,
        status:  c.status,
        spend:   toNum(c.spend),
        revenue: toNum(c.revenue),
      });
    }
  }

  const campList: CampaignRow[] = Array.from(campAgg.values())
    .map(c => ({
      ...c,
      profit: c.revenue - c.spend,
      roi:    c.spend > 0 ? (c.revenue - c.spend) / c.spend * 100 : 0,
    }))
    .sort((a, b) => a.profit - b.profit); // worst first

  const alerts: AlertCampaign[] = campList
    .filter(c => c.status === "ACTIVE" && c.roi < -10)
    .slice(0, 5);

  const topCampaigns: CampaignRow[] = campList.slice(0, 10);

  // ── Trend: previous period ─────────────────────────────────────────────────
  const durationMs   = new Date(dateTo + "T00:00:00Z").getTime() - new Date(dateFrom + "T00:00:00Z").getTime();
  const prevFromDate = new Date(new Date(dateFrom + "T00:00:00Z").getTime() - durationMs);
  const prevToDate   = new Date(new Date(dateFrom + "T00:00:00Z").getTime() - 1);

  let prevCampaigns: { spend: Decimal; revenue: Decimal }[] = [];
  try {
    prevCampaigns = await prisma.campaign.findMany({
      where: {
        userId,
        dateFrom: { gte: prevFromDate },
        dateTo:   { lte: prevToDate },
      },
      select: { spend: true, revenue: true },
    });
  } catch { /* ignore — trend will be null */ }

  const prevProfit  = prevCampaigns.reduce((s, c) => s + toNum(c.revenue) - toNum(c.spend), 0);
  const trend: number | null = prevProfit !== 0
    ? Math.round(((totalProfit - prevProfit) / Math.abs(prevProfit)) * 100)
    : null;

  return {
    totals: { totalSpend, totalRevenue, totalProfit, roi, totalImps, totalClicks, totalConvs, ctr, ctrNoPop, clickImps, clickClicks, clickCtr, popImps, popConvs, popConvRate },
    chartData,
    networkBreakdown: Array.from(netMap.entries()).map(([network, stats]) => ({
      network, ...stats,
      profit: stats.revenue - stats.spend,
      roi: stats.spend > 0 ? ((stats.revenue - stats.spend) / stats.spend) * 100 : 0,
    })),
    activeCampaigns: new Set(safeCampaigns.filter(c => c.status === "ACTIVE").map(c => c.externalId)).size,
    alerts,
    topCampaigns,
    trend,
    needsSync: false,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dateFrom  = iso30DaysAgo();
  const dateTo    = isoToday();
  const cookieStore = await cookies();
  const forceDemo   = cookieStore.get("profitdash_demo")?.value === "1";
  const { totals, chartData, networkBreakdown, activeCampaigns, alerts, topCampaigns, trend, needsSync } =
    await getDashboardData(user.id, dateFrom, dateTo, forceDemo);

  return (
    <BentoDashboard
      totals={totals}
      chartData={chartData}
      networkBreakdown={networkBreakdown}
      activeCampaigns={activeCampaigns}
      alerts={alerts}
      topCampaigns={topCampaigns}
      trend={trend}
      needsSync={needsSync}
      profitLabel={fmtEuro(totals.totalProfit)}
      roiLabel={fmtPct(totals.roi)}
      spendLabel={fmtEuro(totals.totalSpend)}
      convLabel={totals.totalConvs.toLocaleString("en-GB")}
      spendSub={`${fmtEuro(totals.totalRevenue)} revenue − ${fmtEuro(totals.totalSpend)} spend`}
      convSub={`CTR ${totals.ctr.toFixed(2)}% · ${totals.totalClicks.toLocaleString("en-GB")} clicks`}
    />
  );
}
