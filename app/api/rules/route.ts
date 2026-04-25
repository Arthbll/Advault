/**
 * GET  /api/rules  — charge la DecisionRule de l'utilisateur (ou defaults)
 * PUT  /api/rules  — upsert la DecisionRule de l'utilisateur
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }           from "@/lib/supabase/server";
import { prisma }                 from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";

const DEFAULTS = {
  preset:         "balanced",
  engineMode:     "recommendation",
  killRoi:        -30,
  watchLow:       -15,
  watchHigh:      0,
  scaleRoi:       30,
  scaleIncrement: 10,
  minSpend:       20,
  minConversions: 3,
  killHoldMin:    30,
  scaleHoldMin:   60,
  killCooldownH:  6,
  scaleCooldownH: 6,
  maxKillsDay:    5,
  maxScalesDay:   2,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  const rule = await prisma.decisionRule.findUnique({ where: { userId } });
  return NextResponse.json(rule ?? { ...DEFAULTS, userId });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  let body: Partial<typeof DEFAULTS>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  // Validation engineMode
  if (body.engineMode !== undefined && !["automatic", "recommendation"].includes(body.engineMode)) {
    return NextResponse.json({ error: "engineMode must be 'automatic' or 'recommendation'" }, { status: 400 });
  }

  const data = {
    preset:         body.preset         ?? DEFAULTS.preset,
    engineMode:     body.engineMode     ?? DEFAULTS.engineMode,
    killRoi:        body.killRoi        ?? DEFAULTS.killRoi,
    watchLow:       body.watchLow       ?? DEFAULTS.watchLow,
    watchHigh:      body.watchHigh      ?? DEFAULTS.watchHigh,
    scaleRoi:       body.scaleRoi       ?? DEFAULTS.scaleRoi,
    scaleIncrement: body.scaleIncrement ?? DEFAULTS.scaleIncrement,
    minSpend:       body.minSpend       ?? DEFAULTS.minSpend,
    minConversions: body.minConversions ?? DEFAULTS.minConversions,
    killHoldMin:    body.killHoldMin    ?? DEFAULTS.killHoldMin,
    scaleHoldMin:   body.scaleHoldMin   ?? DEFAULTS.scaleHoldMin,
    killCooldownH:  body.killCooldownH  ?? DEFAULTS.killCooldownH,
    scaleCooldownH: body.scaleCooldownH ?? DEFAULTS.scaleCooldownH,
    maxKillsDay:    body.maxKillsDay    ?? DEFAULTS.maxKillsDay,
    maxScalesDay:   body.maxScalesDay   ?? DEFAULTS.maxScalesDay,
  };

  try {
    await prisma.decisionRule.upsert({
      where:  { userId },
      create: { userId, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
