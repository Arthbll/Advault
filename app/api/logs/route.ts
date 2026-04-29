import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma }       from "@/lib/prisma";
import { LogType }      from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { getSessionPlanId } from "@/lib/plan-access";
import { PLANS } from "@/lib/plans";

/**
 * GET /api/logs?type=KILL_SWITCH_TRIGGERED&limit=30
 * Returns recent log entries for the authenticated user.
 * Free plan (observer) → data capped to last 7 days (dataRetentionDays).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const planId = await getSessionPlanId();
  const { dataRetentionDays } = PLANS[planId];

  const sp      = new URL(req.url).searchParams;
  const typeRaw = sp.get("type");
  const limit   = Math.min(parseInt(sp.get("limit") ?? "50"), 200);

  // Validate type against known LogType enum values — reject unknown values
  const VALID_LOG_TYPES = Object.values(LogType) as string[];
  const type = typeRaw
    ? (VALID_LOG_TYPES.includes(typeRaw) ? (typeRaw as LogType) : null)
    : null;
  if (typeRaw && !type) {
    return NextResponse.json({ error: `Invalid log type: ${typeRaw}` }, { status: 400 });
  }

  // Retention window: null = unlimited, N = last N days
  const retentionFilter = dataRetentionDays !== null
    ? { createdAt: { gte: new Date(Date.now() - dataRetentionDays * 86_400_000) } }
    : {};

  try {
    const logs = await prisma.log.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
        ...retentionFilter,
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
      select:  {
        id:         true,
        type:       true,
        message:    true,
        metadata:   true,
        createdAt:  true,
        campaignId: true,
      },
    });

    return NextResponse.json({ logs, retentionDays: dataRetentionDays });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
