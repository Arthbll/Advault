/**
 * GET /api/debug/migrate-conversions
 * Crée la table Conversion si elle n'existe pas encore.
 * À appeler une seule fois depuis le navigateur.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma }       from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Conversion" (
        "id"         TEXT NOT NULL PRIMARY KEY,
        "userId"     TEXT NOT NULL,
        "campaignId" TEXT,
        "clickId"    TEXT,
        "revenue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
        "currency"   TEXT NOT NULL DEFAULT 'USD',
        "source"     TEXT,
        "ip"         TEXT,
        "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Conversion_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversion_userId_createdAt_idx"
      ON "Conversion"("userId", "createdAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversion_userId_campaignId_idx"
      ON "Conversion"("userId", "campaignId")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversion_clickId_idx"
      ON "Conversion"("clickId")
    `);

    return NextResponse.json({ ok: true, message: "Table Conversion créée (ou déjà existante)." });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
