/**
 * POST /api/plan/update
 * Body: { plan: "Observer" | "Operator" | "Dominion" | "Command" }
 *
 * Met à jour le plan d'un utilisateur dans Supabase user_metadata.
 *
 * SÉCURITÉ : cet endpoint est réservé aux appels internes (webhook Stripe,
 * admin dashboard). Il est protégé par PLAN_UPDATE_SECRET.
 *
 * ⚠️ Sans cette protection, n'importe quel utilisateur connecté pouvait
 *    s'upgrader gratuitement vers le plan Command.
 *
 * Usage depuis un webhook Stripe :
 *   Authorization: Bearer $PLAN_UPDATE_SECRET
 *   Body: { userId: "uuid", plan: "Operator" }
 *
 * Usage admin :
 *   Authorization: Bearer $PLAN_UPDATE_SECRET
 *   Body: { userId: "uuid", plan: "Command" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const VALID_PLANS = ["Observer", "Operator", "Dominion", "Command"] as const;
type Plan = (typeof VALID_PLANS)[number];

export async function POST(req: NextRequest) {
  // ── Authentification par secret interne ───────────────────────────────────
  const secret = process.env.PLAN_UPDATE_SECRET;
  if (!secret) {
    // En prod, l'absence du secret bloque tout — ne pas laisser passer
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 501 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validation du body ────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { userId?: string; plan?: string };

  const { userId, plan } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (!plan || !VALID_PLANS.includes(plan as Plan)) {
    return NextResponse.json({ error: `Invalid plan. Valid: ${VALID_PLANS.join(", ")}` }, { status: 400 });
  }

  // ── Mise à jour via service role ──────────────────────────────────────────
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 501 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  // Récupérer les métadonnées actuelles pour ne pas les écraser
  const { data: userData, error: fetchError } = await adminClient.auth.admin.getUserById(userId);
  if (fetchError || !userData.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { ...userData.user.user_metadata, plan },
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, plan });
}
