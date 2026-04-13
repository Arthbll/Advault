import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma }       from "@/lib/prisma";
import { LogType }      from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";

/**
 * GET /api/logs?type=KILL_SWITCH_TRIGGERED&limit=30
 * Returns recent log entries for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

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

  try {
    const logs = await prisma.log.findMany({
      where: {
        userId: userId,
        ...(type ? { type } : {}),
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

    return NextResponse.json({ logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
