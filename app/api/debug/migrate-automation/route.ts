/**
 * GET /api/debug/migrate-automation
 * Crée la table AutomationRule si elle n'existe pas.
 * Appelez une fois depuis le navigateur pour initialiser.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AutomationRule" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "userId"      TEXT NOT NULL,
        "name"        TEXT NOT NULL,
        "enabled"     BOOLEAN NOT NULL DEFAULT true,
        "condition"   TEXT NOT NULL,
        "threshold"   DOUBLE PRECISION NOT NULL,
        "action"      TEXT NOT NULL,
        "actionValue" DOUBLE PRECISION,
        "network"     TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastRunAt"   TIMESTAMP(3),
        CONSTRAINT "AutomationRule_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AutomationRule_userId_idx"
      ON "AutomationRule"("userId")
    `);

    return NextResponse.json({ ok: true, message: "Table AutomationRule créée (ou déjà existante)." });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
