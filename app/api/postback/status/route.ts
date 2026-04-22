/**
 * GET /api/postback/status
 *
 * Retourne l'état postback de l'utilisateur connecté, pour alimenter la
 * bannière de sécurité dans le dashboard et les pages connexes.
 *
 * Utilisé par :
 *   - bannière "configure ton postback" (inGracePeriod + mode automatic)
 *   - bannière "engine downgraded" (wasDowngraded === true)
 *   - badge "data missing" sur les campagnes (hasAnyPostback === false)
 *
 * Source de vérité :
 *   - hasAnyPostback → table Conversion, existence d'une ligne pour ce userId
 *   - oldestAccountCreatedAt → table Account, première connexion réseau
 *   - wasDowngraded → table Log, entrée SAFETY_DOWNGRADE dans les 7 derniers jours
 */

import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { LogType } from "@prisma/client";

const GRACE_PERIOD_HOURS = 48;

export async function GET() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // ── Parallèles pour perf ──────────────────────────────────────────────────
  const [firstPostback, oldestAccount, recentDowngrade, decisionRule, settings] = await Promise.all([
    prisma.conversion.findFirst({
      where:   { userId },
      orderBy: { createdAt: "asc" },
      select:  { createdAt: true },
    }),
    prisma.account.findFirst({
      where:   { userId, isActive: true },
      orderBy: { createdAt: "asc" },
      select:  { createdAt: true },
    }),
    prisma.log.findFirst({
      where: {
        userId,
        type:      "SAFETY_DOWNGRADE" as LogType,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) },
      },
      orderBy: { createdAt: "desc" },
      select:  { createdAt: true, metadata: true },
    }),
    prisma.decisionRule.findUnique({
      where:  { userId },
      select: { engineMode: true },
    }).catch(() => null),
    prisma.userSettings.findUnique({
      where:  { userId },
      select: { spendOnlyMode: true, killSwitchEnabled: true },
    }),
  ]);

  // ── Calculs ───────────────────────────────────────────────────────────────
  const hasAnyPostback = firstPostback !== null;
  const now            = Date.now();
  const graceMs        = GRACE_PERIOD_HOURS * 60 * 60_000;

  let inGracePeriod       = false;
  let hoursUntilDowngrade: number | null = null;

  if (!hasAnyPostback && oldestAccount && !settings?.spendOnlyMode) {
    const elapsedMs   = now - oldestAccount.createdAt.getTime();
    const remainingMs = graceMs - elapsedMs;

    if (remainingMs > 0) {
      inGracePeriod       = true;
      hoursUntilDowngrade = Math.max(0, Math.ceil(remainingMs / (60 * 60_000)));
    }
  }

  return NextResponse.json({
    hasAnyPostback,
    firstPostbackAt:         firstPostback?.createdAt ?? null,
    oldestAccountConnectedAt: oldestAccount?.createdAt ?? null,
    inGracePeriod,
    hoursUntilDowngrade,
    wasDowngraded:           recentDowngrade !== null,
    downgradedAt:            recentDowngrade?.createdAt ?? null,
    currentEngineMode:       decisionRule?.engineMode ?? null,
    spendOnlyMode:           settings?.spendOnlyMode ?? false,
    killSwitchEnabled:       settings?.killSwitchEnabled ?? false,
    gracePeriodHours:        GRACE_PERIOD_HOURS,
  });
}
