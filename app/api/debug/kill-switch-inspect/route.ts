/**
 * GET /api/debug/kill-switch-inspect
 * Debug endpoint: shows exactly what the kill-switch sees for each campaign.
 * Returns full evaluation without actually killing anything.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { Network, CampaignStatus } from "@prisma/client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const spendOnlyMode = (settings as unknown as Record<string, unknown>).spendOnlyMode === true;

  const accounts = await prisma.account.findMany({ where: { userId: user.id, isActive: true } });

  const report: unknown[] = [];

  for (const account of accounts) {
    if (account.network !== Network.EXOCLICK) continue;

    let apiKey: string;
    try { apiKey = decrypt(account.apiKeyEnc); }
    catch (e) { report.push({ account: account.id, error: `decrypt: ${e}` }); continue; }

    const adapter = new ExoClickAdapter(apiKey);

    let freshStats: Awaited<ReturnType<typeof adapter.getStats>>;
    try { freshStats = await adapter.getStats(today, today); }
    catch (e) { report.push({ account: account.id, error: `getStats: ${e}` }); continue; }

    const statsMap: Record<string, typeof freshStats[0]> = {};
    for (const s of freshStats) statsMap[String(s.campaignId)] = s;

    const activeCampaigns = await prisma.campaign.findMany({
      where: { userId: user.id, accountId: account.id, network: Network.EXOCLICK, status: CampaignStatus.ACTIVE },
      orderBy: { syncedAt: "desc" },
    });

    const seen = new Set<string>();
    const campaigns = activeCampaigns.filter(c => {
      if (seen.has(c.externalId)) return false;
      seen.add(c.externalId);
      return true;
    });

    // Cumulative spend/revenue from DB
    const externalIds = campaigns.map(c => c.externalId);
    const cumulative = await prisma.$queryRaw<{ externalId: string; totalSpend: number; totalRevenue: number }[]>`
      SELECT "externalId", SUM(spend) AS "totalSpend", SUM(revenue) AS "totalRevenue"
      FROM "Campaign"
      WHERE "userId" = ${user.id} AND "accountId" = ${account.id} AND "externalId" = ANY(${externalIds})
      GROUP BY "externalId"
    `;
    const cumMap: Record<string, { totalSpend: number; totalRevenue: number }> = {};
    for (const row of cumulative) cumMap[row.externalId] = { totalSpend: Number(row.totalSpend), totalRevenue: Number(row.totalRevenue) };

    for (const campaign of campaigns) {
      const stat = statsMap[campaign.externalId];
      const cum  = cumMap[campaign.externalId];
      const freshSpend   = (stat?.spent   ?? 0) > 0 ? stat!.spent   : (cum?.totalSpend   ?? 0);
      const freshRevenue = (stat?.revenue ?? 0) > 0 ? stat!.revenue! : (cum?.totalRevenue ?? 0);
      const profit       = freshRevenue - freshSpend;
      const roi          = freshSpend > 0 ? (profit / freshSpend) * 100 : 0;
      const roiTrigger   = !spendOnlyMode && freshSpend > 0 && roi < (settings?.roiThreshold ?? -50);
      const budgetTrigger = settings?.maxSpendPerCampaign != null && freshSpend > settings.maxSpendPerCampaign;

      report.push({
        campaign:          campaign.name,
        externalId:        campaign.externalId,
        status:            campaign.status,
        dbRowSpend:        Number(campaign.spend),
        dbRowRevenue:      Number(campaign.revenue),
        cumulativeSpend:   cum?.totalSpend ?? 0,
        cumulativeRevenue: cum?.totalRevenue ?? 0,
        exoClickStatFound: !!stat,
        exoClickSpend:     stat?.spent ?? null,
        exoClickRevenue:   stat?.revenue ?? null,
        freshSpend,
        freshRevenue,
        roi:               parseFloat(roi.toFixed(2)),
        roiThreshold:      settings?.roiThreshold,
        maxSpend:          settings?.maxSpendPerCampaign,
        spendOnlyMode,
        roiTrigger,
        budgetTrigger,
        wouldKill:         roiTrigger || budgetTrigger,
      });
    }
  }

  return NextResponse.json({
    today,
    settings: {
      killSwitchEnabled: settings?.killSwitchEnabled,
      roiThreshold: settings?.roiThreshold,
      maxSpendPerCampaign: settings?.maxSpendPerCampaign,
      spendOnlyMode,
    },
    campaigns: report,
  });
}
