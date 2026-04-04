/**
 * PUT    /api/automation/[id]  → update a rule
 * DELETE /api/automation/[id]  → delete a rule
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  // Verify ownership
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "AutomationRule" WHERE id = ${id} AND "userId" = ${user.id}
  `;
  if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    name        = undefined,
    enabled     = undefined,
    condition   = undefined,
    threshold   = undefined,
    action      = undefined,
    actionValue = undefined,
    network     = undefined,
  } = body;

  const now = new Date();

  try {
    // Build dynamic update
    if (name       !== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "name"        = ${name},       "updatedAt" = ${now} WHERE id = ${id}`;
    if (enabled    !== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "enabled"     = ${enabled},    "updatedAt" = ${now} WHERE id = ${id}`;
    if (condition  !== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "condition"   = ${condition},  "updatedAt" = ${now} WHERE id = ${id}`;
    if (threshold  !== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "threshold"   = ${threshold},  "updatedAt" = ${now} WHERE id = ${id}`;
    if (action     !== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "action"      = ${action},     "updatedAt" = ${now} WHERE id = ${id}`;
    if (actionValue!== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "actionValue" = ${actionValue},"updatedAt" = ${now} WHERE id = ${id}`;
    if (network    !== undefined) await prisma.$executeRaw`UPDATE "AutomationRule" SET "network"     = ${network},    "updatedAt" = ${now} WHERE id = ${id}`;

    const [updated] = await prisma.$queryRaw<{ id: string; name: string; enabled: boolean }[]>`
      SELECT id, name, enabled, condition, threshold, action, "actionValue", network, "createdAt", "lastRunAt"
      FROM "AutomationRule" WHERE id = ${id}
    `;
    return NextResponse.json({ rule: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.$executeRaw`
      DELETE FROM "AutomationRule" WHERE id = ${id} AND "userId" = ${user.id}
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
