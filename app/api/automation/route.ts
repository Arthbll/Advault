/**
 * GET  /api/automation  → list rules for current user
 * POST /api/automation  → create a new rule
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────
export type RuleCondition =
  | "ROI_BELOW"
  | "ROI_ABOVE"
  | "SPEND_ABOVE"
  | "REVENUE_BELOW"
  | "CPC_ABOVE";

export type RuleAction =
  | "PAUSE_CAMPAIGN"
  | "SCALE_BUDGET"
  | "NOTIFY";

export interface AutomationRule {
  id:          string;
  name:        string;
  enabled:     boolean;
  condition:   RuleCondition;
  threshold:   number;
  action:      RuleAction;
  actionValue: number | null;
  network:     string | null;
  createdAt:   string;
  lastRunAt:   string | null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.$queryRaw<AutomationRule[]>`
      SELECT
        id, name, enabled, condition, threshold, action,
        "actionValue", network,
        "createdAt", "lastRunAt"
      FROM "AutomationRule"
      WHERE "userId" = ${user.id}
      ORDER BY "createdAt" DESC
    `;
    return NextResponse.json({ rules: rows });
  } catch {
    // Table may not exist yet
    return NextResponse.json({ rules: [] });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name:        string;
    condition:   RuleCondition;
    threshold:   number;
    action:      RuleAction;
    actionValue?: number | null;
    network?:    string | null;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const { name, condition, threshold, action, actionValue = null, network = null } = body;

  if (!name || !condition || threshold == null || !action) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const VALID_CONDITIONS: RuleCondition[] = ["ROI_BELOW", "ROI_ABOVE", "SPEND_ABOVE", "REVENUE_BELOW", "CPC_ABOVE"];
  const VALID_ACTIONS:    RuleAction[]    = ["PAUSE_CAMPAIGN", "SCALE_BUDGET", "NOTIFY"];

  if (!VALID_CONDITIONS.includes(condition) || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Condition ou action invalide" }, { status: 400 });
  }

  try {
    const id  = randomUUID();
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO "AutomationRule"
        ("id", "userId", "name", "enabled", "condition", "threshold", "action", "actionValue", "network", "createdAt", "updatedAt")
      VALUES
        (${id}, ${user.id}, ${name}, true, ${condition}, ${threshold}, ${action}, ${actionValue}, ${network}, ${now}, ${now})
    `;

    const [created] = await prisma.$queryRaw<AutomationRule[]>`
      SELECT id, name, enabled, condition, threshold, action, "actionValue", network, "createdAt", "lastRunAt"
      FROM "AutomationRule" WHERE id = ${id}
    `;

    return NextResponse.json({ rule: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
