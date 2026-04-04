/**
 * POST /api/campaigns/[id]/engine-control
 *
 * Toggle per-campaign engine control flags.
 * Body: { action: "exclude" | "pause-automation" | "include" | "resume-automation" }
 *
 * Requires migration: GET /api/debug/migrate-engine-controls first.
 */

import { NextRequest, NextResponse }  from "next/server";
import { createClient }               from "@/lib/supabase/server";
import { prisma }                     from "@/lib/prisma";
import { resolveWorkspaceUserId }     from "@/lib/workspace";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const { id } = await params;
  const body   = await req.json() as { action: string };

  const campaign = await prisma.campaign.findFirst({ where: { id, userId } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  try {
    if (body.action === "exclude" || body.action === "include") {
      const val = body.action === "exclude";
      await prisma.$executeRawUnsafe(
        `UPDATE "Campaign" SET "excludeFromEngine" = $1 WHERE id = $2`,
        val, id,
      );
      return NextResponse.json({ ok: true, excludeFromEngine: val });
    }

    if (body.action === "pause-automation" || body.action === "resume-automation") {
      const val = body.action === "pause-automation";
      await prisma.$executeRawUnsafe(
        `UPDATE "Campaign" SET "automationPaused" = $1 WHERE id = $2`,
        val, id,
      );
      return NextResponse.json({ ok: true, automationPaused: val });
    }

    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const { id } = await params;

  try {
    const rows = await prisma.$queryRawUnsafe<{ excludeFromEngine: boolean; automationPaused: boolean }[]>(
      `SELECT "excludeFromEngine", "automationPaused" FROM "Campaign" WHERE id = $1 AND "userId" = $2 LIMIT 1`,
      id, userId,
    );
    if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch {
    // Columns may not exist yet — return defaults
    return NextResponse.json({ excludeFromEngine: false, automationPaused: false });
  }
}
