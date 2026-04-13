/**
 * GET /api/engine/actions
 *
 * Retourne les derniers événements du Decision Engine pour l'utilisateur connecté.
 * Source : table Log avec types KILL_SWITCH_TRIGGERED | DECISION_KILL | DECISION_WATCH | DECISION_SCALE
 *
 * Réponse :
 *   events[]         — liste formatée pour le frontend
 *   todayCount       — nombre d'events depuis minuit
 *   killedToday      — kills du jour
 *   watchToday       — watches du jour
 *   scaledToday      — scales du jour
 *   rulesCount       — nb de règles actives (0 si pas de DecisionRule, 3 si configurée)
 *   protectedAmount  — somme du spend sauvé par les KILL aujourd'hui (€)
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies }                  from "next/headers";
import { createClient }             from "@/lib/supabase/server";
import { prisma }                   from "@/lib/prisma";
import { resolveWorkspaceUserId }   from "@/lib/workspace";

type Tone = "rose" | "amber" | "emerald";

function logTypeToEvent(type: string, message: string): { state: string; tone: Tone; isRecommend: boolean } {
  const isRecommend = message.startsWith("[RECOMMEND]");
  // CAMPAIGN_ACTION with [RECOMMEND] or [AUTOMATION] prefix = scale event
  if (type === "CAMPAIGN_ACTION" || type === "DECISION_SCALE")
    return { state: "SCALE", tone: "emerald", isRecommend };
  if (type === "DECISION_WATCH")
    return { state: "WATCH", tone: "amber", isRecommend };
  // KILL_SWITCH_TRIGGERED + DECISION_KILL → kill or recommend-pause
  return { state: "KILL", tone: "rose", isRecommend };
}

function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s <    60) return `${s}s ago`;
  if (s <  3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return               `${Math.round(s / 86400)}d ago`;
}

export async function GET(_req: NextRequest) {
  // ── Demo mode ─────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  if (cookieStore.get("profitdash_demo")?.value === "1") {
    const { getDemoEngineActions } = await import("@/lib/demo-data");
    return NextResponse.json(getDemoEngineActions());
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  // ── Parallel queries ─────────────────────────────────────────────────────
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const [rows, decisionRuleRows, protectedRows] = await Promise.all([
    // Engine events (last 20)
    prisma.$queryRawUnsafe<Array<{
      id: string; type: string; message: string;
      metadata: unknown; createdAt: Date;
      campaignName: string | null; network: string | null;
    }>>(
      `SELECT l."id", l."type", l."message", l."metadata", l."createdAt",
              c."name"    AS "campaignName",
              c."network" AS "network"
       FROM   "Log"      l
       LEFT JOIN "Campaign" c ON c."id" = l."campaignId"
       WHERE  l."userId" = $1
         AND  l."type"   IN (
           'KILL_SWITCH_TRIGGERED',
           'DECISION_KILL',
           'DECISION_WATCH',
           'DECISION_SCALE',
           'CAMPAIGN_ACTION'
         )
       ORDER BY l."createdAt" DESC
       LIMIT  30`,
      userId
    ),

    // Rules count — 1 DecisionRule record = 3 active rules (kill + watch + scale)
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM "DecisionRule" WHERE "userId" = $1`,
      userId
    ).catch(() => [{ count: BigInt(0) }]),

    // Protected amount — sum of spend from KILL events today
    prisma.$queryRawUnsafe<Array<{ total: number | null }>>(
      `SELECT COALESCE(SUM((metadata->>'spend')::float), 0) AS total
       FROM   "Log"
       WHERE  "userId" = $1
         AND  "type"   IN ('KILL_SWITCH_TRIGGERED', 'DECISION_KILL')
         AND  "createdAt" >= $2
         AND  metadata->>'spend' IS NOT NULL`,
      userId,
      todayMidnight
    ).catch(() => [{ total: 0 }]),
  ]);

  // ── Calculs jour courant ───────────────────────────────────────────────────
  const todayRows = rows.filter(r => new Date(r.createdAt) >= todayMidnight);

  // Derived values from parallel queries
  const hasDecisionRule  = Number(decisionRuleRows[0]?.count ?? 0) > 0;
  const rulesCount       = hasDecisionRule ? 3 : 0; // kill + watch + scale
  const protectedAmount  = Number(protectedRows[0]?.total ?? 0);

  const killedToday    = todayRows.filter(r =>
    (r.type === "KILL_SWITCH_TRIGGERED" || r.type === "DECISION_KILL")
    && !r.message?.startsWith("[RECOMMEND]")
  ).length;
  const watchToday     = todayRows.filter(r => r.type === "DECISION_WATCH").length;
  const scaledToday    = todayRows.filter(r =>
    (r.type === "DECISION_SCALE" || r.type === "CAMPAIGN_ACTION")
    && !r.message?.startsWith("[RECOMMEND]")
  ).length;
  const suggestPause   = todayRows.filter(r =>
    r.message?.startsWith("[RECOMMEND]") && (r.type === "KILL_SWITCH_TRIGGERED" || r.type === "DECISION_KILL")
  ).length;
  const suggestScale   = todayRows.filter(r =>
    r.message?.startsWith("[RECOMMEND]") && (r.type === "CAMPAIGN_ACTION" || r.type === "DECISION_SCALE")
  ).length;
  const suggestTotal   = suggestPause + suggestScale;

  // ── Format événements ─────────────────────────────────────────────────────
  const events = rows.map(row => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const { state, tone, isRecommend } = logTypeToEvent(row.type, row.message ?? "");

    // Clean campaign name — avoid exposing raw UUIDs or "Unknown campaign"
    const rawCampaignName = meta.campaignName ?? row.campaignName;
    const isUuid = typeof rawCampaignName === "string" && /^[0-9a-f-]{36}$/i.test(rawCampaignName.trim());
    let campaign: string;
    if (rawCampaignName && !isUuid) {
      campaign = String(rawCampaignName).trim();
    } else {
      // Extract name from message text: handles "→ Name (Network)" and "[…] "Name" (…)" patterns
      const msg = row.message ?? "";
      const quotedMatch  = msg.match(/["\u201c\u00ab]([^"\u201d\u00bb]{3,80})["\u201d\u00bb]/);
      const arrowMatch   = msg.match(/→\s+(.+?)\s*\(/);
      const extracted    = (quotedMatch?.[1] ?? arrowMatch?.[1] ?? "").trim();
      campaign = extracted.length > 0 ? extracted : "Campaign";
    }

    const network  = String(meta.network ?? row.network ?? "");
    const roi      = typeof meta.roi     === "number" ? meta.roi     : null;
    const spend    = typeof meta.spend   === "number" ? meta.spend   : null;
    const scalePct = typeof meta.scalePct === "number" ? meta.scalePct : null;
    const reason   = String(meta.reason ?? "");

    // ── SCALE : montrer le montant injecté ────────────────────────────────────
    let detail: string;
    if (state === "SCALE" && scalePct !== null && spend !== null) {
      const injected = spend * (scalePct / 100);
      const newBid   = spend + injected;
      detail = `+${scalePct}% · €${spend.toFixed(0)} → €${newBid.toFixed(0)} (+€${injected.toFixed(0)} injecté)`;
    } else if (state === "SCALE" && roi !== null && spend !== null) {
      // Fallback : pas de scalePct → on estime +25% par défaut
      const injected = spend * 0.25;
      const newBid   = spend + injected;
      detail = `ROI ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% · €${spend.toFixed(0)} → €${newBid.toFixed(0)} (+€${injected.toFixed(0)})`;
    } else if (roi !== null) {
      // Only append reason if it looks human-written — reject computed/internal strings
      const reasonIsClean = reason
        && reason.length > 0
        && reason.length < 60
        && !reason.startsWith("ROI")           // already shown separately
        && !/[<>≤≥]/.test(reason)              // raw comparisons
        && !/\d+\.?\d*%/.test(reason)          // raw percentage expressions
        && !/(threshold|seuil|below|above)/i.test(reason); // internal labels
      detail = `ROI ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%${reasonIsClean ? ` · ${reason}` : ""}`;
    } else {
      // Avoid surfacing raw DB messages — only show clean short strings
      const reasonIsClean = reason
        && reason.length > 0
        && reason.length < 60
        && !/[<>≤≥]/.test(reason)
        && !/(threshold|seuil)/i.test(reason);
      detail = reasonIsClean ? reason : "Rule triggered";
    }

    return {
      id:          row.id,
      state,
      tone,
      isRecommend,
      campaign,
      network,
      detail,
      time:        timeAgo(new Date(row.createdAt)),
      createdAt:   new Date(row.createdAt).toISOString(),
    };
  });

  // Most recent engine event — used as "last scan" proxy on the frontend
  const lastEventAt = rows[0]
    ? new Date(rows[0].createdAt).toISOString()
    : null;

  return NextResponse.json({
    events,
    todayCount:    todayRows.length,
    killedToday,
    watchToday,
    scaledToday,
    suggestTotal,
    suggestPause,
    suggestScale,
    rulesCount,
    protectedAmount,
    lastEventAt,
  });
}
