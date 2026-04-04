import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { resolveWorkspaceUserId } from "@/lib/workspace";

function toNum(d: Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : parseFloat(d.toString());
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── Demo mode: ID starts with "demo:" — bypass auth ───────────────────────
  if (id.startsWith("demo:")) {
    const { getDemoCampaignDetail } = await import("@/lib/demo-data");
    const sp     = new URL(req.url).searchParams;
    const dFrom  = sp.get("dateFrom") ?? undefined;
    const dTo    = sp.get("dateTo")   ?? undefined;
    const detail = getDemoCampaignDetail(id, dFrom, dTo);
    if (!detail) return NextResponse.json({ error: "Demo campaign not found" }, { status: 404 });
    return NextResponse.json(detail);
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  // Find the latest record for this campaign (by DB uuid)
  const latest = await withTimeout(
    prisma.campaign.findFirst({
      where: { id, userId: userId },
      orderBy: { syncedAt: "desc" },
    }),
    null,
    3000,
  );

  if (!latest) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

  // Fetch all daily records for this campaign (same externalId + network + user)
  const dailyRecords = await withTimeout(
    prisma.campaign.findMany({
      where: {
        userId:     userId,
        externalId: latest.externalId,
        network:    latest.network,
      },
      orderBy: { dateFrom: "asc" },
    }),
    [],
    3000,
  );

  // Build daily chart data (aggregate by date)
  const byDate = new Map<string, { spend: number; revenue: number; impressions: number; clicks: number }>();
  for (const r of dailyRecords) {
    const key = r.dateFrom.toISOString().slice(0, 10);
    const cur = byDate.get(key) ?? { spend: 0, revenue: 0, impressions: 0, clicks: 0 };
    byDate.set(key, {
      spend:       cur.spend       + toNum(r.spend),
      revenue:     cur.revenue     + toNum(r.revenue),
      impressions: cur.impressions + r.impressions,
      clicks:      cur.clicks      + r.clicks,
    });
  }

  const chartData = Array.from(byDate.entries()).map(([date, d]) => {
    const [, m, day] = date.split("-");
    return {
      date:        `${day}/${m}`,
      spend:       d.spend,
      revenue:     d.revenue,
      profit:      d.revenue - d.spend,
      impressions: d.impressions,
      clicks:      d.clicks,
    };
  });

  // Totals from all daily records
  const totalSpend   = dailyRecords.reduce((s, r) => s + toNum(r.spend),   0);
  const totalImps    = dailyRecords.reduce((s, r) => s + r.impressions,    0);
  const totalClicks  = dailyRecords.reduce((s, r) => s + r.clicks,         0);
  const totalConvs   = dailyRecords.reduce((s, r) => s + r.conversions,    0);

  // ── Conversions postback pour cette campagne ──────────────────────────────
  let postbackRevenue = 0;
  let postbackConvs   = 0;
  let recentConversions: {
    id: string; revenue: number; currency: string;
    source: string | null; clickId: string | null; createdAt: Date;
  }[] = [];
  try {
    const agg = await prisma.$queryRaw<{ total_revenue: number; total_count: bigint }[]>`
      SELECT COALESCE(SUM("revenue"),0)::float AS total_revenue, COUNT(*) AS total_count
      FROM "Conversion"
      WHERE "userId"     = ${userId}
        AND "campaignId" = ${latest.externalId}
    `;
    postbackRevenue = Number(agg[0]?.total_revenue ?? 0);
    postbackConvs   = Number(agg[0]?.total_count   ?? 0);

    recentConversions = await prisma.$queryRaw<typeof recentConversions>`
      SELECT "id", "revenue"::float AS revenue, "currency", "source", "clickId", "createdAt"
      FROM "Conversion"
      WHERE "userId" = ${userId} AND "campaignId" = ${latest.externalId}
      ORDER BY "createdAt" DESC
      LIMIT 20
    `;
  } catch { /* table non encore créée — ignore */ }

  const campaignRevenue = dailyRecords.reduce((s, r) => s + toNum(r.revenue), 0);
  const totalRevenue    = campaignRevenue + postbackRevenue;
  const totalProfit     = totalRevenue - totalSpend;
  const roi             = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;
  const ctr             = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;

  return NextResponse.json({
    campaign: {
      id:         latest.id,
      externalId: latest.externalId,
      name:       latest.name,
      network:    latest.network,
      status:     latest.status,
      syncedAt:   latest.syncedAt,
    },
    totals: {
      totalSpend, totalRevenue, totalProfit, roi,
      totalImps, totalClicks, totalConvs: totalConvs + postbackConvs, ctr,
      postbackRevenue, postbackConvs,
    },
    chartData,
    dailyCount: dailyRecords.length,
    recentConversions,
  });
}
