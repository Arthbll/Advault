import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { resolveWorkspaceUserId } from "@/lib/workspace";

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : parseFloat(d.toString());
}

const ZERO_STATE = {
  totals: {
    totalSpend: 0, totalRevenue: 0, totalProfit: 0, roi: 0,
    totalImps: 0, totalClicks: 0, totalConvs: 0, ctr: 0, ctrNoPop: 0,
    postbackRevenue: 0, postbackConvs: 0,
    clickImps: 0, clickClicks: 0, clickCtr: 0,
    popImps: 0, popConvs: 0, popConvRate: 0,
  },
  chartData: [],
  networkBreakdown: [],
  activeCampaigns: 0,
  alerts: [],
  topCampaigns: [],
  trend: null,
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo   = searchParams.get("dateTo")   ?? new Date().toISOString().slice(0, 10);

  // ── Vérifier si des comptes sont connectés ────────────────────────────────
  let accountCount = 0;
  try {
    accountCount = await prisma.account.count({ where: { userId: userId, isActive: true } });
  } catch { /* DB unreachable */ }

  // ── Current period ─────────────────────────────────────────────────────────
  let campaigns: Awaited<ReturnType<typeof prisma.campaign.findMany>> = [];
  try {
    campaigns = await prisma.campaign.findMany({
      where: {
        userId:   userId,
        dateFrom: { gte: new Date(dateFrom) },
        dateTo:   { lte: new Date(dateTo + "T23:59:59Z") },
      },
    });
  } catch { /* DB unreachable — return zero state */ }

  // Account connected but no campaigns synced yet → zero state (not demo)
  if (campaigns.length === 0) {
    return NextResponse.json(ZERO_STATE);
  }

  const totalSpend      = campaigns.reduce((s, c) => s + toNum(c.spend),   0);
  const campaignRevenue = campaigns.reduce((s, c) => s + toNum(c.revenue), 0);

  // ── Conversions postback (revenu réel CPA) ──────────────────────────────
  // Note: utilise $queryRaw car la table Conversion n'est pas encore dans le client Prisma généré.
  // Après `npx prisma generate`, on pourra utiliser prisma.conversion.aggregate().
  let postbackRevenue = 0;
  let postbackConvs   = 0;
  try {
    const convAgg = await prisma.$queryRaw<{ total_revenue: number; total_count: bigint }[]>`
      SELECT
        COALESCE(SUM("revenue"), 0)::float AS total_revenue,
        COUNT("id") AS total_count
      FROM "Conversion"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${new Date(dateFrom + "T00:00:00Z")}
        AND "createdAt" <= ${new Date(dateTo   + "T23:59:59Z")}
    `;
    if (convAgg.length > 0) {
      postbackRevenue = Number(convAgg[0].total_revenue);
      postbackConvs   = Number(convAgg[0].total_count);
    }
  } catch { /* ignore — DB peut être indisponible ou table non encore créée */ }

  const totalRevenue = campaignRevenue + postbackRevenue;
  const totalProfit  = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;
  const totalImps    = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks  = campaigns.reduce((s, c) => s + c.clicks,      0);
  const totalConvs   = campaigns.reduce((s, c) => s + c.conversions, 0) + postbackConvs;
  const ctr          = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;

  // CTR excluding Pop/Popunder formats (auto-click bias)
  const nonPop       = campaigns.filter(c => !/pop/i.test(c.name));
  const impsNoPop    = nonPop.reduce((s, c) => s + c.impressions, 0);
  const clicksNoPop  = nonPop.reduce((s, c) => s + c.clicks, 0);
  const ctrNoPop     = impsNoPop > 0 ? (clicksNoPop / impsNoPop) * 100 : 0;

  // Format-split metrics (click vs. pop)
  const popCmps     = campaigns.filter(c => /pop/i.test((c as { format?: string }).format ?? c.name));
  const clickCmps   = campaigns.filter(c => !/pop/i.test((c as { format?: string }).format ?? c.name));
  const clickImps   = clickCmps.reduce((s, c) => s + c.impressions, 0);
  const clickClicks = clickCmps.reduce((s, c) => s + c.clicks,      0);
  const clickCtr    = clickImps > 0 ? (clickClicks / clickImps) * 100 : 0;
  const popImps     = popCmps.reduce((s, c) => s + c.impressions,  0);
  const popConvs    = popCmps.reduce((s, c) => s + c.conversions,  0);
  const popConvRate = popImps > 0 ? (popConvs / popImps) * 100 : 0;

  // ── Chart by day ───────────────────────────────────────────────────────────

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

  // ── Per-network ────────────────────────────────────────────────────────────

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

  // ── Per-campaign P&L ───────────────────────────────────────────────────────

  // Récupérer le revenu postback groupé par campaignId (raw SQL, table non dans le client généré)
  const pbByCampaign = new Map<string, number>();
  try {
    const pbRows = await prisma.$queryRaw<{ campaign_id: string; total: number }[]>`
      SELECT "campaignId" AS campaign_id, SUM("revenue")::float AS total
      FROM "Conversion"
      WHERE "userId" = ${userId}
        AND "campaignId" IS NOT NULL
        AND "createdAt" >= ${new Date(dateFrom + "T00:00:00Z")}
        AND "createdAt" <= ${new Date(dateTo   + "T23:59:59Z")}
      GROUP BY "campaignId"
    `;
    for (const row of pbRows) {
      if (row.campaign_id) pbByCampaign.set(row.campaign_id, Number(row.total));
    }
  } catch { /* ignore */ }

  const campAgg = new Map<string, {
    id: string; name: string; network: string; status: string;
    spend: number; revenue: number;
  }>();
  for (const c of campaigns) {
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

  // Ajouter le revenu postback aux campagnes correspondantes
  for (const [extId, rev] of pbByCampaign) {
    const camp = campAgg.get(extId);
    if (camp) {
      camp.revenue += rev;
    } else {
      // Conversion pour une campagne hors période — on l'ignore dans le tableau
    }
  }

  const campList = Array.from(campAgg.values())
    .map(c => ({
      ...c,
      profit: c.revenue - c.spend,
      roi:    c.spend > 0 ? (c.revenue - c.spend) / c.spend * 100 : 0,
    }))
    .sort((a, b) => a.profit - b.profit); // worst first

  const alerts = campList
    .filter(c => c.status === "ACTIVE" && c.roi < -10)
    .slice(0, 5);

  const topCampaigns = campList.slice(0, 10);

  // ── Trend: compare with previous period ────────────────────────────────────

  const durationMs    = new Date(dateTo + "T00:00:00Z").getTime() - new Date(dateFrom + "T00:00:00Z").getTime();
  const prevFromDate  = new Date(new Date(dateFrom + "T00:00:00Z").getTime() - durationMs);
  const prevToDate    = new Date(new Date(dateFrom + "T00:00:00Z").getTime() - 1);

  let prevCampaigns: { spend: Decimal; revenue: Decimal }[] = [];
  try {
    prevCampaigns = await prisma.campaign.findMany({
      where: {
        userId:   userId,
        dateFrom: { gte: prevFromDate },
        dateTo:   { lte: prevToDate },
      },
      select: { spend: true, revenue: true },
    });
  } catch { /* ignore — trend will be null */ }

  const prevProfit = prevCampaigns.reduce(
    (s, c) => s + toNum(c.revenue) - toNum(c.spend), 0
  );
  const trend: number | null = prevProfit !== 0
    ? Math.round(((totalProfit - prevProfit) / Math.abs(prevProfit)) * 100)
    : null;

  // ── Response ───────────────────────────────────────────────────────────────

  return NextResponse.json({
    totals: {
      totalSpend, totalRevenue, totalProfit, roi,
      totalImps, totalClicks, totalConvs, ctr, ctrNoPop,
      postbackRevenue, postbackConvs,
      // Format-split metrics
      clickImps, clickClicks, clickCtr,
      popImps, popConvs, popConvRate,
    },
    chartData,
    networkBreakdown: Array.from(netMap.entries()).map(([network, s]) => ({
      network, ...s,
      profit: s.revenue - s.spend,
      roi: s.spend > 0 ? ((s.revenue - s.spend) / s.spend) * 100 : 0,
    })),
    activeCampaigns: new Set(campaigns.filter(c => c.status === "ACTIVE").map(c => c.externalId)).size,
    alerts,
    topCampaigns,
    trend,
  });
}
