/**
 * GET  /api/settings  → return all user settings (UserSettings + DecisionRule)
 * PUT  /api/settings  → update any combination of fields
 *
 * Single endpoint that exposes the full engine configuration:
 * kill-switch, budget alerts, ROI thresholds, cooldowns, engine mode.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  killSwitchEnabled:    false,
  spendOnlyMode:        false,
  roiThreshold:         -50,
  maxSpendPerCampaign:  null as number | null,
  checkIntervalMinutes: 30,
  budgetAlertEnabled:   false,
  dailyBudgetLimit:     null as number | null,
  enginePausedUntil:    null as string | null,
};

const DEFAULT_DECISION = {
  preset:         "balanced",
  engineMode:     "automatic",
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

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const [settings, decision] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userId } }),
    prisma.decisionRule.findUnique({ where: { userId: userId } }),
  ]);

  return NextResponse.json({
    settings: {
      killSwitchEnabled:    settings?.killSwitchEnabled    ?? DEFAULT_SETTINGS.killSwitchEnabled,
      spendOnlyMode:        settings?.spendOnlyMode        ?? DEFAULT_SETTINGS.spendOnlyMode,
      roiThreshold:         settings?.roiThreshold         ?? DEFAULT_SETTINGS.roiThreshold,
      maxSpendPerCampaign:  settings?.maxSpendPerCampaign  ?? DEFAULT_SETTINGS.maxSpendPerCampaign,
      checkIntervalMinutes: settings?.checkIntervalMinutes ?? DEFAULT_SETTINGS.checkIntervalMinutes,
      budgetAlertEnabled:   settings?.budgetAlertEnabled   ?? DEFAULT_SETTINGS.budgetAlertEnabled,
      dailyBudgetLimit:     settings?.dailyBudgetLimit     ?? DEFAULT_SETTINGS.dailyBudgetLimit,
      enginePausedUntil:    settings?.enginePausedUntil?.toISOString() ?? DEFAULT_SETTINGS.enginePausedUntil,
    },
    decision: {
      preset:         decision?.preset         ?? DEFAULT_DECISION.preset,
      engineMode:     decision?.engineMode     ?? DEFAULT_DECISION.engineMode,
      killRoi:        decision?.killRoi        ?? DEFAULT_DECISION.killRoi,
      watchLow:       decision?.watchLow       ?? DEFAULT_DECISION.watchLow,
      watchHigh:      decision?.watchHigh      ?? DEFAULT_DECISION.watchHigh,
      scaleRoi:       decision?.scaleRoi       ?? DEFAULT_DECISION.scaleRoi,
      scaleIncrement: decision?.scaleIncrement ?? DEFAULT_DECISION.scaleIncrement,
      minSpend:       decision?.minSpend       ?? DEFAULT_DECISION.minSpend,
      minConversions: decision?.minConversions ?? DEFAULT_DECISION.minConversions,
      killHoldMin:    decision?.killHoldMin    ?? DEFAULT_DECISION.killHoldMin,
      scaleHoldMin:   decision?.scaleHoldMin   ?? DEFAULT_DECISION.scaleHoldMin,
      killCooldownH:  decision?.killCooldownH  ?? DEFAULT_DECISION.killCooldownH,
      scaleCooldownH: decision?.scaleCooldownH ?? DEFAULT_DECISION.scaleCooldownH,
      maxKillsDay:    decision?.maxKillsDay    ?? DEFAULT_DECISION.maxKillsDay,
      maxScalesDay:   decision?.maxScalesDay   ?? DEFAULT_DECISION.maxScalesDay,
      timeWindowStart: (decision as { timeWindowStart?: number | null } | null)?.timeWindowStart ?? null,
      timeWindowEnd:   (decision as { timeWindowEnd?:   number | null } | null)?.timeWindowEnd   ?? null,
    },
  });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  let body: {
    // UserSettings fields
    killSwitchEnabled?:    boolean;
    spendOnlyMode?:        boolean;
    roiThreshold?:         number;
    maxSpendPerCampaign?:  number | null;
    checkIntervalMinutes?: number;
    budgetAlertEnabled?:   boolean;
    dailyBudgetLimit?:     number | null;
    enginePausedUntil?:    string | null;
    // DecisionRule fields
    preset?:         string;
    engineMode?:     string;
    killRoi?:        number;
    watchLow?:       number;
    scaleRoi?:       number;
    scaleIncrement?: number;
    minSpend?:       number;
    minConversions?: number;
    killHoldMin?:    number;
    scaleHoldMin?:   number;
    killCooldownH?:  number;
    scaleCooldownH?: number;
    maxKillsDay?:      number;
    maxScalesDay?:     number;
    timeWindowStart?:  number | null;
    timeWindowEnd?:    number | null;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  // ── Validate numeric ranges ────────────────────────────────────────────────
  if (body.killCooldownH !== undefined && (body.killCooldownH < 0 || body.killCooldownH > 168)) {
    return NextResponse.json({ error: "killCooldownH must be 0–168" }, { status: 400 });
  }
  if (body.scaleCooldownH !== undefined && (body.scaleCooldownH < 0 || body.scaleCooldownH > 168)) {
    return NextResponse.json({ error: "scaleCooldownH must be 0–168" }, { status: 400 });
  }
  if (body.engineMode !== undefined && !["automatic", "recommendation"].includes(body.engineMode)) {
    return NextResponse.json({ error: "engineMode must be 'automatic' or 'recommendation'" }, { status: 400 });
  }
  if (body.roiThreshold !== undefined && (body.roiThreshold < -100 || body.roiThreshold > 10000)) {
    return NextResponse.json({ error: "roiThreshold must be -100–10000" }, { status: 400 });
  }
  if (body.maxSpendPerCampaign !== undefined && body.maxSpendPerCampaign !== null && body.maxSpendPerCampaign < 0) {
    return NextResponse.json({ error: "maxSpendPerCampaign must be >= 0" }, { status: 400 });
  }
  if (body.scaleIncrement !== undefined && (body.scaleIncrement < 1 || body.scaleIncrement > 500)) {
    return NextResponse.json({ error: "scaleIncrement must be 1–500 (%)" }, { status: 400 });
  }
  if (body.killRoi !== undefined && (body.killRoi < -100 || body.killRoi > 10000)) {
    return NextResponse.json({ error: "killRoi must be -100–10000" }, { status: 400 });
  }
  if (body.scaleRoi !== undefined && (body.scaleRoi < -100 || body.scaleRoi > 10000)) {
    return NextResponse.json({ error: "scaleRoi must be -100–10000" }, { status: 400 });
  }
  if (body.minSpend !== undefined && body.minSpend < 0) {
    return NextResponse.json({ error: "minSpend must be >= 0" }, { status: 400 });
  }
  if (body.minConversions !== undefined && (body.minConversions < 0 || body.minConversions > 10000)) {
    return NextResponse.json({ error: "minConversions must be 0–10000" }, { status: 400 });
  }
  if (body.maxKillsDay !== undefined && (body.maxKillsDay < 0 || body.maxKillsDay > 1000)) {
    return NextResponse.json({ error: "maxKillsDay must be 0–1000" }, { status: 400 });
  }
  if (body.maxScalesDay !== undefined && (body.maxScalesDay < 0 || body.maxScalesDay > 1000)) {
    return NextResponse.json({ error: "maxScalesDay must be 0–1000" }, { status: 400 });
  }
  if (body.timeWindowStart !== undefined && body.timeWindowStart !== null && (body.timeWindowStart < 0 || body.timeWindowStart > 23)) {
    return NextResponse.json({ error: "timeWindowStart must be 0–23" }, { status: 400 });
  }
  if (body.timeWindowEnd !== undefined && body.timeWindowEnd !== null && (body.timeWindowEnd < 0 || body.timeWindowEnd > 23)) {
    return NextResponse.json({ error: "timeWindowEnd must be 0–23" }, { status: 400 });
  }

  const updates: Promise<unknown>[] = [];

  // ── UserSettings fields ────────────────────────────────────────────────────
  const settingsData: Record<string, unknown> = {};
  if (body.killSwitchEnabled    !== undefined) settingsData.killSwitchEnabled    = body.killSwitchEnabled;
  if (body.spendOnlyMode        !== undefined) settingsData.spendOnlyMode        = body.spendOnlyMode;
  if (body.roiThreshold         !== undefined) settingsData.roiThreshold         = body.roiThreshold;
  if (body.maxSpendPerCampaign  !== undefined) settingsData.maxSpendPerCampaign  = body.maxSpendPerCampaign;
  if (body.checkIntervalMinutes !== undefined) settingsData.checkIntervalMinutes = body.checkIntervalMinutes;
  if (body.budgetAlertEnabled   !== undefined) settingsData.budgetAlertEnabled   = body.budgetAlertEnabled;
  if (body.dailyBudgetLimit     !== undefined) settingsData.dailyBudgetLimit     = body.dailyBudgetLimit;
  if (body.enginePausedUntil    !== undefined) settingsData.enginePausedUntil    = body.enginePausedUntil ? new Date(body.enginePausedUntil) : null;

  if (Object.keys(settingsData).length > 0) {
    updates.push(
      prisma.userSettings.upsert({
        where:  { userId: userId },
        create: { userId: userId, ...settingsData } as never,
        update: settingsData as never,
      }),
    );
  }

  // ── DecisionRule fields ────────────────────────────────────────────────────
  const decisionData: Record<string, unknown> = {};
  if (body.preset         !== undefined) decisionData.preset         = body.preset;
  if (body.engineMode     !== undefined) decisionData.engineMode     = body.engineMode;
  if (body.killRoi        !== undefined) decisionData.killRoi        = body.killRoi;
  if (body.watchLow       !== undefined) decisionData.watchLow       = body.watchLow;
  if (body.scaleRoi       !== undefined) decisionData.scaleRoi       = body.scaleRoi;
  if (body.scaleIncrement !== undefined) decisionData.scaleIncrement = body.scaleIncrement;
  if (body.minSpend       !== undefined) decisionData.minSpend       = body.minSpend;
  if (body.minConversions !== undefined) decisionData.minConversions = body.minConversions;
  if (body.killHoldMin    !== undefined) decisionData.killHoldMin    = body.killHoldMin;
  if (body.scaleHoldMin   !== undefined) decisionData.scaleHoldMin   = body.scaleHoldMin;
  if (body.killCooldownH  !== undefined) decisionData.killCooldownH  = body.killCooldownH;
  if (body.scaleCooldownH !== undefined) decisionData.scaleCooldownH = body.scaleCooldownH;
  if (body.maxKillsDay    !== undefined) decisionData.maxKillsDay    = body.maxKillsDay;
  if (body.maxScalesDay      !== undefined) decisionData.maxScalesDay      = body.maxScalesDay;
  if (body.timeWindowStart   !== undefined) decisionData.timeWindowStart   = body.timeWindowStart;
  if (body.timeWindowEnd     !== undefined) decisionData.timeWindowEnd     = body.timeWindowEnd;

  if (Object.keys(decisionData).length > 0) {
    updates.push(
      prisma.decisionRule.upsert({
        where:  { userId: userId },
        create: { userId: userId, ...decisionData } as never,
        update: decisionData as never,
      }),
    );
  }

  if (!updates.length) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  try {
    await Promise.all(updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
