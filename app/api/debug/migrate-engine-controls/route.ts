/**
 * GET /api/debug/migrate-engine-controls
 *
 * Idempotent one-time migration.
 * Adds engine control columns needed for Blocs 4/5/6:
 *   - Campaign.excludeFromEngine  BOOLEAN DEFAULT false
 *   - Campaign.automationPaused   BOOLEAN DEFAULT false
 *   - DecisionRule.engineMode     TEXT DEFAULT 'automatic'
 *   - UserSettings.enginePausedUntil TIMESTAMPTZ NULL
 *
 * Call once from Chrome: GET http://localhost:3000/api/debug/migrate-engine-controls
 */

import { NextResponse }          from "next/server";
import { prisma }                from "@/lib/prisma";
import { createClient }          from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Auth guard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const steps: string[] = [];

  // ── 1. Campaign.excludeFromEngine ─────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Campaign"
      ADD COLUMN IF NOT EXISTS "excludeFromEngine" BOOLEAN NOT NULL DEFAULT false
    `);
    steps.push("✅ Campaign.excludeFromEngine added");
  } catch (e) {
    steps.push(`ℹ️ Campaign.excludeFromEngine: ${String(e)}`);
  }

  // ── 2. Campaign.automationPaused ──────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Campaign"
      ADD COLUMN IF NOT EXISTS "automationPaused" BOOLEAN NOT NULL DEFAULT false
    `);
    steps.push("✅ Campaign.automationPaused added");
  } catch (e) {
    steps.push(`ℹ️ Campaign.automationPaused: ${String(e)}`);
  }

  // ── 3. DecisionRule.engineMode ────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DecisionRule"
      ADD COLUMN IF NOT EXISTS "engineMode" TEXT NOT NULL DEFAULT 'automatic'
    `);
    steps.push("✅ DecisionRule.engineMode added");
  } catch (e) {
    steps.push(`ℹ️ DecisionRule.engineMode: ${String(e)}`);
  }

  // ── 4. UserSettings.enginePausedUntil ─────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "UserSettings"
      ADD COLUMN IF NOT EXISTS "enginePausedUntil" TIMESTAMPTZ NULL
    `);
    steps.push("✅ UserSettings.enginePausedUntil added");
  } catch (e) {
    steps.push(`ℹ️ UserSettings.enginePausedUntil: ${String(e)}`);
  }

  return NextResponse.json({ ok: true, steps });
}
