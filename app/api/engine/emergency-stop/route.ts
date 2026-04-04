/**
 * GET  /api/engine/emergency-stop  — current pause state
 * POST /api/engine/emergency-stop  — set pause state
 *   Body: { action: "pause" | "resume", durationH?: number }
 *   Default durationH = 24h
 *
 * Requires migration: GET /api/debug/migrate-engine-controls first.
 */

import { NextRequest, NextResponse }  from "next/server";
import { createClient }               from "@/lib/supabase/server";
import { prisma }                     from "@/lib/prisma";
import { resolveWorkspaceUserId }     from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  try {
    const rows = await prisma.$queryRawUnsafe<{ enginePausedUntil: string | null }[]>(
      `SELECT "enginePausedUntil" FROM "UserSettings" WHERE "userId" = $1 LIMIT 1`,
      userId,
    );
    const pausedUntil = rows[0]?.enginePausedUntil ?? null;
    const paused      = pausedUntil != null && new Date(pausedUntil) > new Date();
    return NextResponse.json({ paused, pausedUntil });
  } catch {
    return NextResponse.json({ paused: false, pausedUntil: null });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const body   = await req.json() as { action: "pause" | "resume"; durationH?: number };

  try {
    if (body.action === "resume") {
      // Clear the pause
      await prisma.$executeRawUnsafe(
        `UPDATE "UserSettings" SET "enginePausedUntil" = NULL WHERE "userId" = $1`,
        userId,
      );
      return NextResponse.json({ ok: true, paused: false, pausedUntil: null });
    }

    if (body.action === "pause") {
      const hours     = body.durationH ?? 24;
      const until     = new Date(Date.now() + hours * 3600 * 1000).toISOString();

      // Upsert: insert row if not present, update otherwise
      await prisma.$executeRawUnsafe(`
        INSERT INTO "UserSettings" ("id", "userId", "enginePausedUntil", "updatedAt", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2::timestamptz, NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE SET
          "enginePausedUntil" = EXCLUDED."enginePausedUntil",
          "updatedAt"         = NOW()
      `, userId, until);

      return NextResponse.json({ ok: true, paused: true, pausedUntil: until });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
