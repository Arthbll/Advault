/**
 * GET  /api/rules  — load the authenticated user's DecisionRule (or defaults)
 * PUT  /api/rules  — upsert the authenticated user's DecisionRule
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { prisma }                    from "@/lib/prisma";
import { resolveWorkspaceUserId }    from "@/lib/workspace";

// Default values — mirror PRESETS["balanced"] in the frontend
const DEFAULTS = {
  preset:         "balanced",
  killRoi:        -30,
  watchLow:       -15,
  watchHigh:      0,
  scaleRoi:       30,
  scaleIncrement: 10,
  minSpend:       20,
  minConversions: 3,
  killHoldMin:    30,
  scaleHoldMin:   60,
  killCooldownH:  3,
  scaleCooldownH: 6,
  maxKillsDay:    5,
  maxScalesDay:   2,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  try {
    const rule = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT * FROM "DecisionRule" WHERE "userId" = $1 LIMIT 1
    `, userId);

    return NextResponse.json(rule[0] ?? { ...DEFAULTS, userId });
  } catch {
    // Table may not exist yet — return defaults gracefully
    return NextResponse.json({ ...DEFAULTS, userId });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  const body = await req.json() as Partial<typeof DEFAULTS & { preset: string; engineMode: string }>;

  const preset         = body.preset         ?? DEFAULTS.preset;
  const engineMode     = body.engineMode     ?? "automatic";
  const killRoi        = body.killRoi        ?? DEFAULTS.killRoi;
  const watchLow       = body.watchLow       ?? DEFAULTS.watchLow;
  const watchHigh      = body.watchHigh      ?? DEFAULTS.watchHigh;
  const scaleRoi       = body.scaleRoi       ?? DEFAULTS.scaleRoi;
  const scaleIncrement = body.scaleIncrement ?? DEFAULTS.scaleIncrement;
  const minSpend       = body.minSpend       ?? DEFAULTS.minSpend;
  const minConversions = body.minConversions ?? DEFAULTS.minConversions;
  const killHoldMin    = body.killHoldMin    ?? DEFAULTS.killHoldMin;
  const scaleHoldMin   = body.scaleHoldMin   ?? DEFAULTS.scaleHoldMin;
  const killCooldownH  = body.killCooldownH  ?? DEFAULTS.killCooldownH;
  const scaleCooldownH = body.scaleCooldownH ?? DEFAULTS.scaleCooldownH;
  const maxKillsDay    = body.maxKillsDay    ?? DEFAULTS.maxKillsDay;
  const maxScalesDay   = body.maxScalesDay   ?? DEFAULTS.maxScalesDay;

  try {
    // Upsert via raw SQL — avoids Prisma client regeneration requirement
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DecisionRule" (
        "id", "userId", "preset",
        "killRoi", "watchLow", "watchHigh",
        "scaleRoi", "scaleIncrement",
        "minSpend", "minConversions",
        "killHoldMin", "scaleHoldMin",
        "killCooldownH", "scaleCooldownH",
        "maxKillsDay", "maxScalesDay",
        "updatedAt", "createdAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2,
        $3, $4, $5,
        $6, $7,
        $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        NOW(), NOW()
      )
      ON CONFLICT ("userId") DO UPDATE SET
        "preset"         = EXCLUDED."preset",
        "killRoi"        = EXCLUDED."killRoi",
        "watchLow"       = EXCLUDED."watchLow",
        "watchHigh"      = EXCLUDED."watchHigh",
        "scaleRoi"       = EXCLUDED."scaleRoi",
        "scaleIncrement" = EXCLUDED."scaleIncrement",
        "minSpend"       = EXCLUDED."minSpend",
        "minConversions" = EXCLUDED."minConversions",
        "killHoldMin"    = EXCLUDED."killHoldMin",
        "scaleHoldMin"   = EXCLUDED."scaleHoldMin",
        "killCooldownH"  = EXCLUDED."killCooldownH",
        "scaleCooldownH" = EXCLUDED."scaleCooldownH",
        "maxKillsDay"    = EXCLUDED."maxKillsDay",
        "maxScalesDay"   = EXCLUDED."maxScalesDay",
        "updatedAt"      = NOW()
    `,
      userId, preset,
      killRoi, watchLow, watchHigh,
      scaleRoi, scaleIncrement,
      minSpend, minConversions,
      killHoldMin, scaleHoldMin,
      killCooldownH, scaleCooldownH,
      maxKillsDay, maxScalesDay,
    );

    // engineMode — stored in the engineMode column (added via migrate-engine-controls)
    // Gracefully update if column exists; ignore if not yet migrated
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "DecisionRule" SET "engineMode" = $1 WHERE "userId" = $2`,
        engineMode, userId,
      );
    } catch { /* column not yet added — run /api/debug/migrate-engine-controls */ }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
