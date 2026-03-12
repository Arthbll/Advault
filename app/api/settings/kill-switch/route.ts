import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  return NextResponse.json(settings ?? {
    killSwitchEnabled:    false,
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
    roiThreshold?:         number;
    maxSpendPerCampaign?:  number | null;
    checkIntervalMinutes?: number;
  };

  const settings = await prisma.userSettings.upsert({
    where:  { userId: user.id },
    create: {
      userId:               user.id,
      killSwitchEnabled:    body.killSwitchEnabled    ?? false,
      roiThreshold:         body.roiThreshold         ?? -50,
      maxSpendPerCampaign:  body.maxSpendPerCampaign  ?? null,
      checkIntervalMinutes: body.checkIntervalMinutes ?? 30,
    },
    update: {
      killSwitchEnabled:    body.killSwitchEnabled    ?? undefined,
      roiThreshold:         body.roiThreshold         ?? undefined,
      maxSpendPerCampaign:  body.maxSpendPerCampaign  ?? null,
      checkIntervalMinutes: body.checkIntervalMinutes ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, settings });
}
