/**
 * GET  /api/engine/emergency-stop  — état du pause global du moteur
 * POST /api/engine/emergency-stop  — activer / désactiver la pause
 *   Body: { action: "pause" | "resume", durationH?: number }
 *   Default durationH = 24h
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

  const settings = await prisma.userSettings.findUnique({
    where:  { userId },
    select: { enginePausedUntil: true },
  });

  const pausedUntil = settings?.enginePausedUntil ?? null;
  const paused      = pausedUntil != null && new Date(pausedUntil) > new Date();

  return NextResponse.json({ paused, pausedUntil: pausedUntil?.toISOString() ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  let body: { action: "pause" | "resume"; durationH?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  try {
    if (body.action === "resume") {
      await prisma.userSettings.upsert({
        where:  { userId },
        create: { userId, enginePausedUntil: null },
        update: { enginePausedUntil: null },
      });
      return NextResponse.json({ ok: true, paused: false, pausedUntil: null });
    }

    if (body.action === "pause") {
      const hours = body.durationH ?? 24;
      const until = new Date(Date.now() + hours * 3600 * 1000);
      await prisma.userSettings.upsert({
        where:  { userId },
        create: { userId, enginePausedUntil: until },
        update: { enginePausedUntil: until },
      });
      return NextResponse.json({ ok: true, paused: true, pausedUntil: until.toISOString() });
    }

    return NextResponse.json({ error: "action must be 'pause' or 'resume'" }, { status: 400 });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
