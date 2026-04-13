/**
 * GET  /api/settings/kill-switch  → kill-switch settings
 * POST /api/settings/kill-switch  → update kill-switch settings
 *
 * Kept for backward compatibility with existing frontend code.
 * Prefer the unified /api/settings endpoint for new features.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const settings = await prisma.userSettings.findUnique({ where: { userId: userId } });

  return NextResponse.json(settings ?? {
    killSwitchEnabled:    false,
    spendOnlyMode:        false,
    roiThreshold:         -50,
    maxSpendPerCampaign:  null,
    checkIntervalMinutes: 30,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    killSwitchEnabled?:    boolean;
    spendOnlyMode?:        boolean;
    roiThreshold?:         number;
    maxSpendPerCampaign?:  number | null;
    checkIntervalMinutes?: number;
  };

  const userId = await resolveWorkspaceUserId(user.id);
  const settings = await prisma.userSettings.upsert({
    where:  { userId: userId },
    create: {
      userId:               userId,
      killSwitchEnabled:    body.killSwitchEnabled    ?? false,
      spendOnlyMode:        body.spendOnlyMode        ?? false,
      roiThreshold:         body.roiThreshold         ?? -50,
      maxSpendPerCampaign:  body.maxSpendPerCampaign  ?? null,
      checkIntervalMinutes: body.checkIntervalMinutes ?? 30,
    },
    update: {
      ...(body.killSwitchEnabled    !== undefined && { killSwitchEnabled:    body.killSwitchEnabled }),
      ...(body.spendOnlyMode        !== undefined && { spendOnlyMode:        body.spendOnlyMode }),
      ...(body.roiThreshold         !== undefined && { roiThreshold:         body.roiThreshold }),
      ...(body.maxSpendPerCampaign  !== undefined && { maxSpendPerCampaign:  body.maxSpendPerCampaign }),
      ...(body.checkIntervalMinutes !== undefined && { checkIntervalMinutes: body.checkIntervalMinutes }),
    },
  });

  return NextResponse.json({ ok: true, settings });
}
