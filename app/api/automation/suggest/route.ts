/**
 * GET /api/automation/suggest
 * Analyse l'historique des 30 derniers jours et suggère des seuils
 * statistiquement pertinents — aucun LLM, 100% gratuit.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface CampaignRow {
  roi:    number;
  spend:  number;
  profit: number;
}

interface Suggestion {
  condition:   string;
  threshold:   number;
  action:      string;
  actionValue: number | null;
  name:        string;
  rationale:   string;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)];
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 86400_000);

  try {
    const rows = await prisma.$queryRaw<CampaignRow[]>`
      SELECT
        CASE WHEN spend > 0 THEN (profit / spend) * 100 ELSE 0 END AS roi,
        spend,
        profit
      FROM "Campaign"
      WHERE "userId" = ${user.id}
        AND "updatedAt" > ${since}
        AND spend > 0
    `;

    if (rows.length < 3) {
      return NextResponse.json({
        suggestions: [],
        message: "Not enough data (minimum 3 active campaigns over 30 days).",
      });
    }

    const rois   = rows.map(r => Number(r.roi)).sort((a, b) => a - b);
    const spends = rows.map(r => Number(r.spend)).sort((a, b) => a - b);

    const roiP25  = Math.round(percentile(rois, 25));
    const roiP75  = Math.round(percentile(rois, 75));
    const roiMed  = Math.round(percentile(rois, 50));
    const spendP90 = Math.round(percentile(spends, 90));
    const avgSpend = Math.round(spends.reduce((a, b) => a + b, 0) / spends.length);

    const suggestions: Suggestion[] = [];

    // 1. Pause losing campaigns: ROI below P25
    if (roiP25 < 0) {
      suggestions.push({
        condition:   "ROI_BELOW",
        threshold:   roiP25,
        action:      "PAUSE_CAMPAIGN",
        actionValue: null,
        name:        `Pause if ROI < ${roiP25}%`,
        rationale:   `${roiP25}% is the bottom quartile of your 30-day ROI (median: ${roiMed}%). Campaigns below this threshold are systematically losing money.`,
      });
    }

    // 2. Scale winners: ROI above P75
    if (roiP75 > 10) {
      suggestions.push({
        condition:   "ROI_ABOVE",
        threshold:   roiP75,
        action:      "SCALE_BUDGET",
        actionValue: 1.3,
        name:        `Scale if ROI > ${roiP75}%`,
        rationale:   `${roiP75}% is the top quartile of your campaigns. Increasing budget by 30% on winners maximises overall profit.`,
      });
    }

    // 3. Spend alert: campaign spending 2x the average
    if (avgSpend > 0) {
      const alertThreshold = Math.round(avgSpend * 2);
      suggestions.push({
        condition:   "SPEND_ABOVE",
        threshold:   alertThreshold,
        action:      "NOTIFY",
        actionValue: null,
        name:        `Spend alert > ${alertThreshold}€`,
        rationale:   `Your average spend is €${avgSpend}. P90 is €${spendP90}. An alert at €${alertThreshold} (2× average) flags an outlier campaign.`,
      });
    }

    return NextResponse.json({
      suggestions,
      stats: { roiP25, roiMed, roiP75, avgSpend, spendP90, sampleSize: rows.length },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
