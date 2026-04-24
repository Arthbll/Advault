/**
 * GET /api/conversions?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=0&limit=50&campaignId=<internalId>
 *
 * Retourne les conversions postback de l'utilisateur connecté.
 * campaignId (optionnel) : UUID interne de la campagne — filtre les conversions
 * liées à cette campagne spécifique (résolution via Campaign.externalId).
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
  const dateFrom    = searchParams.get("dateFrom") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dateTo      = searchParams.get("dateTo")   ?? new Date().toISOString().slice(0, 10);
  const page        = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit       = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const offset      = page * limit;
  const campaignId  = searchParams.get("campaignId"); // internal UUID (optional)

  // Resolve internal campaignId → externalId for Conversion filtering
  let externalCampaignId: string | null = null;
  let campaignName: string | null = null;
  if (campaignId) {
    const camp = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      select: { externalId: true, name: true },
    });
    externalCampaignId = camp?.externalId ?? null;
    campaignName = camp?.name ?? null;
  }

  const from = new Date(dateFrom + "T00:00:00Z");
  const to   = new Date(dateTo   + "T23:59:59Z");

  try {
    // Totaux
    const totals = externalCampaignId
      ? await prisma.$queryRaw<{ total_revenue: number; total_count: bigint }[]>`
          SELECT
            COALESCE(SUM("revenue"), 0)::float AS total_revenue,
            COUNT(*) AS total_count
          FROM "Conversion"
          WHERE "userId"     = ${userId}
            AND "campaignId" = ${externalCampaignId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
        `
      : await prisma.$queryRaw<{ total_revenue: number; total_count: bigint }[]>`
          SELECT
            COALESCE(SUM("revenue"), 0)::float AS total_revenue,
            COUNT(*) AS total_count
          FROM "Conversion"
          WHERE "userId"    = ${userId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
        `;

    // Rows paginées + nom de campagne via sous-requête DISTINCT ON
    const rows = externalCampaignId
      ? await prisma.$queryRaw<{
          id: string; campaign_id: string | null; campaign_internal_id: string | null;
          campaign_name: string | null; click_id: string | null; revenue: number;
          currency: string; source: string | null; created_at: Date;
        }[]>`
          SELECT
            c."id",
            c."campaignId"     AS campaign_id,
            camp."id"          AS campaign_internal_id,
            camp."name"        AS campaign_name,
            c."clickId"        AS click_id,
            c."revenue"::float AS revenue,
            c."currency",
            c."source",
            c."createdAt"      AS created_at
          FROM "Conversion" c
          LEFT JOIN LATERAL (
            SELECT "id", "name" FROM "Campaign"
            WHERE "externalId" = c."campaignId" AND "userId" = ${userId}
            LIMIT 1
          ) camp ON true
          WHERE c."userId"     = ${userId}
            AND c."campaignId" = ${externalCampaignId}
            AND c."createdAt" >= ${from}
            AND c."createdAt" <= ${to}
          ORDER BY c."createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await prisma.$queryRaw<{
          id: string; campaign_id: string | null; campaign_internal_id: string | null;
          campaign_name: string | null; click_id: string | null; revenue: number;
          currency: string; source: string | null; created_at: Date;
        }[]>`
          SELECT
            c."id",
            c."campaignId"     AS campaign_id,
            camp."id"          AS campaign_internal_id,
            camp."name"        AS campaign_name,
            c."clickId"        AS click_id,
            c."revenue"::float AS revenue,
            c."currency",
            c."source",
            c."createdAt"      AS created_at
          FROM "Conversion" c
          LEFT JOIN LATERAL (
            SELECT "id", "name" FROM "Campaign"
            WHERE "externalId" = c."campaignId" AND "userId" = ${userId}
            LIMIT 1
          ) camp ON true
          WHERE c."userId"    = ${userId}
            AND c."createdAt" >= ${from}
            AND c."createdAt" <= ${to}
          ORDER BY c."createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    // Revenu par source (breakdown)
    const bySource = externalCampaignId
      ? await prisma.$queryRaw<{ source: string | null; revenue: number; count: bigint }[]>`
          SELECT "source", SUM("revenue")::float AS revenue, COUNT(*) AS count
          FROM "Conversion"
          WHERE "userId"     = ${userId}
            AND "campaignId" = ${externalCampaignId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
          GROUP BY "source" ORDER BY revenue DESC
        `
      : await prisma.$queryRaw<{ source: string | null; revenue: number; count: bigint }[]>`
          SELECT "source", SUM("revenue")::float AS revenue, COUNT(*) AS count
          FROM "Conversion"
          WHERE "userId"    = ${userId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
          GROUP BY "source" ORDER BY revenue DESC
        `;

    return NextResponse.json({
      totalRevenue:    Number(totals[0]?.total_revenue ?? 0),
      totalCount:      Number(totals[0]?.total_count   ?? 0),
      page,
      limit,
      // When filtering by campaign, expose the name so the UI can show a banner
      filterCampaign:  campaignId ? { id: campaignId, name: campaignName } : null,
      rows: rows.map(r => ({
        id:                 r.id,
        campaignId:         r.campaign_id,
        campaignInternalId: r.campaign_internal_id,
        campaignName:       r.campaign_name,
        clickId:            r.click_id,
        revenue:            Number(r.revenue),
        currency:           r.currency,
        source:             r.source,
        createdAt:          r.created_at,
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
