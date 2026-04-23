/**
 * GET /api/security/logs
 *
 * Returns two log streams for the Security page:
 *   syncLogs   — SYNC + API_ERROR entries (network sync history)
 *   auditTrail — all action entries (engine + manual user actions)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { prisma }                    from "@/lib/prisma";
import { resolveWorkspaceUserId }    from "@/lib/workspace";

function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s <    60) return `${s}s ago`;
  if (s <  3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return               `${Math.round(s / 86400)}d ago`;
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  const sp     = new URL(req.url).searchParams;
  const limit  = Math.min(Number(sp.get("limit") ?? 50), 200);
  const offset = Number(sp.get("offset") ?? 0);

  const SYNC_TYPES    = ["SYNC", "API_ERROR", "AUTH_ERROR"];
  const ACTION_TYPES  = [
    "KILL_SWITCH_TRIGGERED", "KILL_SWITCH_PAUSED", "KILL_SWITCH_RESTORED",
    "CAMPAIGN_ACTION", "BUDGET_ALERT",
    "DECISION_KILL", "DECISION_WATCH", "DECISION_SCALE",
  ];

  // $queryRaw (template literal) utilisé à la place de $queryRawUnsafe :
  // Prisma paramétrise automatiquement toutes les valeurs interpolées,
  // ce qui garantit que userId/limit/offset ne peuvent jamais être interprétés
  // comme du SQL même si leur valeur venait à changer de source à l'avenir.
  const [syncRows, auditRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string; type: string; message: string;
      metadata: unknown; createdAt: Date;
      campaignName: string | null; network: string | null;
    }>>`
      SELECT l."id", l."type", l."message", l."metadata", l."createdAt",
             c."name"    AS "campaignName",
             c."network" AS "network"
      FROM   "Log"   l
      LEFT JOIN "Campaign" c ON c."id" = l."campaignId"
      WHERE  l."userId" = ${userId}
        AND  l."type"   IN ('SYNC','API_ERROR','AUTH_ERROR')
      ORDER BY l."createdAt" DESC
      LIMIT  ${limit} OFFSET ${offset}
    `,
    prisma.$queryRaw<Array<{
      id: string; type: string; message: string;
      metadata: unknown; createdAt: Date;
      campaignName: string | null; network: string | null;
    }>>`
      SELECT l."id", l."type", l."message", l."metadata", l."createdAt",
             c."name"    AS "campaignName",
             c."network" AS "network"
      FROM   "Log"   l
      LEFT JOIN "Campaign" c ON c."id" = l."campaignId"
      WHERE  l."userId" = ${userId}
        AND  l."type"   IN (
          'KILL_SWITCH_TRIGGERED','KILL_SWITCH_PAUSED','KILL_SWITCH_RESTORED',
          'CAMPAIGN_ACTION','BUDGET_ALERT',
          'DECISION_KILL','DECISION_WATCH','DECISION_SCALE',
          'SECURITY_EVENT'
        )
      ORDER BY l."createdAt" DESC
      LIMIT  ${limit} OFFSET ${offset}
    `,
  ]);

  function formatSyncRow(row: typeof syncRows[0]) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const network  = String(meta.network ?? row.network ?? "");
    const campaigns = typeof meta.campaigns === "number" ? meta.campaigns : null;
    const days      = typeof meta.days      === "number" ? meta.days      : null;
    const mode      = typeof meta.mode      === "string" ? meta.mode      : null;
    const isError   = row.type === "API_ERROR" || row.type === "AUTH_ERROR";

    let detail = "";
    if (!isError) {
      if (campaigns !== null && days !== null) detail = `${campaigns} campaign${campaigns !== 1 ? "s" : ""} × ${days} day${days !== 1 ? "s" : ""}`;
      if (mode) detail += detail ? ` · ${mode}` : mode;
    } else {
      // Extract clean error from message
      const msg = row.message ?? "";
      detail = msg.length < 80 ? msg : msg.slice(0, 77) + "…";
    }

    return {
      id:        row.id,
      type:      row.type,
      isError,
      network,
      detail,
      time:      timeAgo(new Date(row.createdAt)),
      datetime:  fmtDate(new Date(row.createdAt)),
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  function formatAuditRow(row: typeof auditRows[0]) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const isRecommend = (row.message ?? "").startsWith("[RECOMMEND]");
    const isAuto      = (row.message ?? "").startsWith("[AUTOMATION]");

    // Derive campaign name
    const rawName = meta.campaignName ?? row.campaignName;
    const isUuid  = typeof rawName === "string" && /^[0-9a-f-]{36}$/i.test(String(rawName).trim());
    let campaign  = rawName && !isUuid ? String(rawName).trim() : "";
    if (!campaign) {
      const msg = row.message ?? "";
      const q = msg.match(/[""]([^"""]{3,80})[""]/) ?? msg.match(/→\s+(.+?)\s*\(/);
      campaign = q?.[1]?.trim() ?? "";
    }

    const network = String(meta.network ?? row.network ?? "");
    const roi     = typeof meta.roi     === "number" ? meta.roi     : null;
    const scalePct = typeof meta.scalePct === "number" ? meta.scalePct : null;

    let action = "";
    let tone: "rose" | "amber" | "emerald" | "blue" | "white" = "white";
    const secEvent = typeof meta.event === "string" ? meta.event : null;
    switch (row.type) {
      case "KILL_SWITCH_TRIGGERED": action = isRecommend ? "Suggest pause" : "Kill"; tone = "rose"; break;
      case "KILL_SWITCH_PAUSED":    action = "Paused";   tone = "amber";   break;
      case "KILL_SWITCH_RESTORED":  action = "Restored"; tone = "emerald"; break;
      case "CAMPAIGN_ACTION":       action = isRecommend ? "Suggest scale" : (isAuto ? "Auto-scale" : "Action"); tone = "emerald"; break;
      case "BUDGET_ALERT":          action = "Alert";    tone = "amber";   break;
      case "DECISION_KILL":         action = isRecommend ? "Suggest pause" : "Engine kill"; tone = "rose"; break;
      case "DECISION_WATCH":        action = "Watch";    tone = "amber";   break;
      case "DECISION_SCALE":        action = isRecommend ? "Suggest scale" : "Engine scale"; tone = "emerald"; break;
      case "SECURITY_EVENT":
        if (secEvent === "new_ip_login") { action = "New IP login"; tone = "rose"; }
        else if (secEvent === "sign_in") { action = "Sign-in";      tone = "white"; }
        else                             { action = "Security";      tone = "amber"; }
        break;
    }

    let detail = "";
    if (row.type === "SECURITY_EVENT") {
      const ip = typeof meta.ip === "string" ? meta.ip : "";
      const prevIp = typeof meta.previousIp === "string" ? meta.previousIp : null;
      detail = ip;
      if (prevIp) detail = `${ip} (was ${prevIp})`;
    } else {
      if (roi !== null) detail = `ROI ${roi >= 0 ? "+" : ""}${Number(roi).toFixed(1)}%`;
      if (scalePct !== null) detail += (detail ? " · " : "") + `+${scalePct}%`;
    }

    return {
      id:        row.id,
      type:      row.type,
      action,
      tone,
      campaign,
      network,
      detail,
      time:      timeAgo(new Date(row.createdAt)),
      datetime:  fmtDate(new Date(row.createdAt)),
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }

  return NextResponse.json({
    syncLogs:   syncRows.map(formatSyncRow),
    auditTrail: auditRows.map(formatAuditRow),
    syncTotal:  syncRows.length,
    auditTotal: auditRows.length,
  });
}
