/**
 * GET /api/debug/migrate-decision-rules
 * Applies three schema changes required by the Decision Rules engine:
 *   1. Creates the DecisionRule table
 *   2. Adds WATCH to CampaignStatus enum
 *   3. Adds DECISION_KILL / DECISION_WATCH / DECISION_SCALE to LogType enum
 * Safe to call multiple times — all operations are idempotent.
 */
import { NextResponse }  from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { prisma }        from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps: string[] = [];

  try {
    // ── 1. DecisionRule table ─────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DecisionRule" (
        "id"             TEXT         NOT NULL PRIMARY KEY,
        "userId"         TEXT         NOT NULL UNIQUE,
        "preset"         TEXT         NOT NULL DEFAULT 'balanced',
        "killRoi"        DOUBLE PRECISION NOT NULL DEFAULT -30,
        "watchLow"       DOUBLE PRECISION NOT NULL DEFAULT -15,
        "watchHigh"      DOUBLE PRECISION NOT NULL DEFAULT 0,
        "scaleRoi"       DOUBLE PRECISION NOT NULL DEFAULT 30,
        "scaleIncrement" DOUBLE PRECISION NOT NULL DEFAULT 10,
        "minSpend"       DOUBLE PRECISION NOT NULL DEFAULT 20,
        "minConversions" INTEGER          NOT NULL DEFAULT 3,
        "killHoldMin"    INTEGER          NOT NULL DEFAULT 30,
        "scaleHoldMin"   INTEGER          NOT NULL DEFAULT 60,
        "killCooldownH"  INTEGER          NOT NULL DEFAULT 3,
        "scaleCooldownH" INTEGER          NOT NULL DEFAULT 6,
        "maxKillsDay"    INTEGER          NOT NULL DEFAULT 5,
        "maxScalesDay"   INTEGER          NOT NULL DEFAULT 2,
        "updatedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DecisionRule_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    steps.push("DecisionRule table created (or already exists)");

    // ── 2. WATCH value in CampaignStatus enum ─────────────────────────────────
    // ALTER TYPE … ADD VALUE is not transactional in PG — must run outside a transaction.
    // We check existence first to stay idempotent.
    const watchExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'WATCH'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CampaignStatus')
      ) AS exists
    `);
    if (!watchExists[0]?.exists) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "CampaignStatus" ADD VALUE 'WATCH'`);
      steps.push("WATCH added to CampaignStatus enum");
    } else {
      steps.push("CampaignStatus.WATCH already exists — skipped");
    }

    // ── 3. Decision log types ─────────────────────────────────────────────────
    for (const val of ["DECISION_KILL", "DECISION_WATCH", "DECISION_SCALE"]) {
      const exists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = '${val}'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'LogType')
        ) AS exists
      `);
      if (!exists[0]?.exists) {
        await prisma.$executeRawUnsafe(`ALTER TYPE "LogType" ADD VALUE '${val}'`);
        steps.push(`LogType.${val} added`);
      } else {
        steps.push(`LogType.${val} already exists — skipped`);
      }
    }

    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ error: String(e), steps }, { status: 500 });
  }
}
