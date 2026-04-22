import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/revenue/signal
 *
 * Lightweight check: does this user have any real revenue in the last 30 days?
 * Used by the Decision Engine UI to determine if Profit Engine should be locked.
 *
 * Returns:
 *   { hasRevenue: boolean, postbackCount: number, campaignRevenue: number }
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 86400_000);

  try {
    // Check postback conversions (most reliable signal)
    const postbackRows = await prisma.$queryRaw<[{ cnt: bigint; total: number }]>`
      SELECT COUNT(*)::bigint AS cnt, COALESCE(SUM(revenue), 0)::float AS total
      FROM "Conversion"
      WHERE "userId" = ${user.id}
        AND "createdAt" >= ${since}
    `;
    const postbackCount   = Number(postbackRows[0]?.cnt ?? 0);
    const postbackRevenue = postbackRows[0]?.total ?? 0;

    // Also check campaign table revenue (some networks report it directly)
    const campaignRows = await prisma.$queryRaw<[{ total: number }]>`
      SELECT COALESCE(SUM(revenue), 0)::float AS total
      FROM "Campaign"
      WHERE "userId" = ${user.id}
        AND "dateFrom" >= ${since}
        AND revenue > 0
    `;
    const campaignRevenue = campaignRows[0]?.total ?? 0;

    const hasRevenue = postbackRevenue > 0 || campaignRevenue > 0;

    return NextResponse.json({
      hasRevenue,
      postbackCount,
      postbackRevenue,
      campaignRevenue,
    });
  } catch {
    // DB unreachable — don't block the UI, assume no revenue
    return NextResponse.json({ hasRevenue: false, postbackCount: 0, postbackRevenue: 0, campaignRevenue: 0 });
  }
}
