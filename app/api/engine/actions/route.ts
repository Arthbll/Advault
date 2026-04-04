/**
 * GET /api/engine/actions?limit=10
 * Returns recent Decision Rules engine actions (Kill / Watch / Scale) for the user.
 * Reads from the Log table — requires DECISION_KILL / DECISION_WATCH / DECISION_SCALE log types.
 */
import { NextRequest, NextResponse }  from "next/server";
import { createClient }               from "@/lib/supabase/server";
import { prisma }                     from "@/lib/prisma";
import { resolveWorkspaceUserId }     from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const limit  = Math.min(parseInt(new URL(req.url).searchParams.get("limit") ?? "10"), 50);

  try {
    // Query raw — avoids dependency on generated Prisma enum types
    const rows = await prisma.$queryRawUnsafe<{
      id:         string;
      type:       string;
      message:    string;
      metadata:   unknown;
      createdAt:  Date;
      campaignId: string | null;
    }[]>(`
      SELECT l."id", l."type", l."message", l."metadata", l."createdAt", l."campaignId",
             c."name" AS "campaignName", c."network"
      FROM   "Log"    l
      LEFT JOIN "Campaign" c ON c."id" = l."campaignId"
      WHERE  l."userId" = $1
        AND  l."type" IN ('DECISION_KILL','DECISION_WATCH','DECISION_SCALE')
      ORDER BY l."createdAt" DESC
      LIMIT  $2
    `, userId, limit);

    return NextResponse.json({ actions: rows });
  } catch {
    // Log types may not exist yet — return empty gracefully
    return NextResponse.json({ actions: [] });
  }
}
