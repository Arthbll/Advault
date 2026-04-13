/**
 * PUT    /api/automation/[id]  → update a rule
 * DELETE /api/automation/[id]  → delete a rule
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { Prisma, RuleCondition, RuleAction, Network } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  // Verify ownership
  const existing = await prisma.automationRule.findFirst({
    where: { id, userId: userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const {
    name, enabled, condition, threshold, action,
    actionValue, network, priority, timeWindowStart, timeWindowEnd,
  } = body;

  // Build update payload — only include fields that were sent
  const data: Prisma.AutomationRuleUpdateInput = {};
  if (name            !== undefined) data.name            = name as string;
  if (enabled         !== undefined) data.enabled         = enabled as boolean;
  if (condition       !== undefined) data.condition       = condition as RuleCondition;
  if (threshold       !== undefined) data.threshold       = threshold as number;
  if (action          !== undefined) data.action          = action as RuleAction;
  if (actionValue     !== undefined) data.actionValue     = (actionValue as number) ?? null;
  if (network         !== undefined) data.network         = (network as Network) ?? null;
  if (priority        !== undefined) data.priority        = priority as number;
  if (timeWindowStart !== undefined) data.timeWindowStart = (timeWindowStart as number) ?? null;
  if (timeWindowEnd   !== undefined) data.timeWindowEnd   = (timeWindowEnd as number)   ?? null;

  try {
    const rule = await prisma.automationRule.update({
      where: { id },
      data,
    });
    return NextResponse.json({ rule });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  try {
    // deleteMany with userId check — safe (no 404 if not found, just 0 rows)
    await prisma.automationRule.deleteMany({
      where: { id, userId: userId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
