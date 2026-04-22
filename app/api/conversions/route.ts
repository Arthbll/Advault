/**
 * GET /api/conversions?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=0&limit=50
 *
 * Retourne les conversions postback de l'utilisateur connecté.
 * Utilise $queryRaw car la table Conversion n'est pas encore dans le client Prisma généré.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { prisma }                    from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo   = searchParams.get("dateTo")   ?? new Date().toISOString().slice(0, 10);
  const page     = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit    = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const offset   = page * limit;

  try {
    // Totaux
    const totals = await prisma.$queryRaw<{ total_revenue: number; total_count: bigint }[]>`
      SELECT
        COALESCE(SUM("revenue"), 0)::float AS total_revenue,
        COUNT(*) AS total_count
      FROM "Conversion"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${new Date(dateFrom + "T00:00:00Z")}
        AND "createdAt" <= ${new Date(dateTo   + "T23:59:59Z")}
    `;

    // Rows paginées + nom de campagne via sous-requête DISTINCT ON
    // (Campaign a une ligne par jour → LEFT JOIN naïf multiplierait les rows)
    const rows = await prisma.$queryRaw<{
      id: string;
      campaign_id: string | null;
      campaign_name: string | null;
      click_id: string | null;
      revenue: number;
      currency: string;
      source: string | null;
      created_at: Date;
    }[]>`
      SELECT
        c."id",
        c."campaignId"     AS campaign_id,
        camp."name"        AS campaign_name,
        c."clickId"        AS click_id,
        c."revenue"::float AS revenue,
        c."currency",
        c."source",
        c."createdAt"      AS created_at
      FROM "Conversion" c
      LEFT JOIN LATERAL (
        SELECT "name"
        FROM "Campaign"
        WHERE "externalId" = c."campaignId"
          AND "userId"     = ${userId}
        LIMIT 1
      ) camp ON true
      WHERE c."userId" = ${userId}
        AND c."createdAt" >= ${new Date(dateFrom + "T00:00:00Z")}
        AND c."createdAt" <= ${new Date(dateTo   + "T23:59:59Z")}
      ORDER BY c."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Revenu par source (breakdown)
    const bySource = await prisma.$queryRaw<{ source: string | null; revenue: number; count: bigint }[]>`
      SELECT
        "source",
        SUM("revenue")::float AS revenue,
        COUNT(*) AS count
      FROM "Conversion"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${new Date(dateFrom + "T00:00:00Z")}
        AND "createdAt" <= ${new Date(dateTo   + "T23:59:59Z")}
      GROUP BY "source"
      ORDER BY revenue DESC
    `;

    return NextResponse.json({
      totalRevenue: Number(totals[0]?.total_revenue ?? 0),
      totalCount:   Number(totals[0]?.total_count   ?? 0),
      page,
      limit,
      rows: rows.map(r => ({
        id:           r.id,
        campaignId:   r.campaign_id,
        campaignName: r.campaign_name,
        clickId:      r.click_id,
        revenue:      Number(r.revenue),
        currency:     r.currency,
        source:       r.source,
        createdAt:    r.created_at,
      })),
      bySource: bySource.map(s => ({
        source:  s.source ?? "unknown",
        revenue: Number(s.revenue),
        count:   Number(s.count),
      })),
    });
  } catch (e) {
    console.error("[/api/conversions]", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
