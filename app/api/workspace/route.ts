/**
 * GET  /api/workspace  — returns current workspace settings (timezone, currency)
 * PATCH /api/workspace — updates timezone and/or currency
 *
 * Uses $queryRaw to avoid regenerating the Prisma client after schema changes.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const VALID_CURRENCIES = [
  "USD","EUR","GBP","JPY","CAD","AUD","CHF","SEK","NOK","DKK",
  "PLN","CZK","HUF","RON","BGN","BRL","MXN","SGD","HKD",
];

interface WsRow { timezone: string; currency: string; }

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.$queryRaw<WsRow[]>`
      SELECT timezone, currency FROM "UserSettings" WHERE "userId" = ${user.id} LIMIT 1
    `;
    return NextResponse.json({
      timezone: rows[0]?.timezone ?? "UTC",
      currency:  rows[0]?.currency  ?? "USD",
    });
  } catch {
    return NextResponse.json({ timezone: "UTC", currency: "USD" });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    timezone?: string;
    currency?: string;
  };

  if (body.timezone !== undefined && (typeof body.timezone !== "string" || body.timezone.length > 64)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }
  if (body.currency !== undefined && !VALID_CURRENCIES.includes(body.currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const tz = body.timezone ?? "UTC";
  const cur = body.currency ?? "USD";

  try {
    // Upsert UserSettings row with timezone/currency
    await prisma.$executeRaw`
      INSERT INTO "UserSettings" (id, "userId", timezone, currency)
      VALUES (gen_random_uuid(), ${user.id}, ${tz}, ${cur})
      ON CONFLICT ("userId") DO UPDATE
        SET timezone = ${tz},
            currency = ${cur},
            "updatedAt" = now()
    `;
    return NextResponse.json({ ok: true, timezone: tz, currency: cur });
  } catch (e) {
    console.error("[/api/workspace] DB error:", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
