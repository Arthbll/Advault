/**
 * GET  /api/automation  → list rules for current user
 * POST /api/automation  → create a new rule
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";
import { RuleCondition, RuleAction, Network } from "@prisma/client";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const rules = await prisma.automationRule.findMany({
    where:   { userId: userId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ rules });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  let body: {
    name:             string;
    condition:        string;
    threshold:        number;
    action:           string;
    actionValue?:     number | null;
    network?:         string | null;
    priority?:        number;
    timeWindowStart?: number | null;
    timeWindowEnd?:   number | null;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const {
    name, condition, threshold, action,
    actionValue     = null,
    network         = null,
    priority        = 0,
    timeWindowStart = null,
    timeWindowEnd   = null,
  } = body;

  if (!name || !condition || threshold == null || !action) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const VALID_CONDITIONS = ["ROI_BELOW", "ROI_ABOVE", "SPEND_ABOVE", "REVENUE_BELOW", "CPC_ABOVE"];
  const VALID_ACTIONS    = ["PAUSE_CAMPAIGN", "SCALE_BUDGET", "NOTIFY"];
  const VALID_NETWORKS   = ["EXOCLICK", "TRAFFICSTARS", "TRAFFICJUNKY", "PROPELLERADS", "ADSTERRA", "VOLUUM", "BEMOB", null];

  if (!VALID_CONDITIONS.includes(condition)) {
    return NextResponse.json({ error: "Condition invalide" }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }
  if (!VALID_NETWORKS.includes(network)) {
    return NextResponse.json({ error: "Réseau invalide" }, { status: 400 });
  }

  try {
    const rule = await prisma.automationRule.create({
      data: {
        userId:          userId,
        name,
        condition:       condition as RuleCondition,
        threshold,
        action:          action as RuleAction,
        actionValue:     actionValue ?? null,
        network:         (network as Network) ?? null,
        priority,
        timeWindowStart: timeWindowStart ?? null,
        timeWindowEnd:   timeWindowEnd   ?? null,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
