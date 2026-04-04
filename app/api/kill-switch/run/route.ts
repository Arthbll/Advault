import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { runKillSwitchForUser, runKillSwitchGlobal } from "@/lib/kill-switch";
import { resolveWorkspaceUserId } from "@/lib/workspace";

// Vercel cron jobs ont jusqu'à 300s sur Pro, 10s sur Hobby
export const maxDuration = 300;

/**
 * GET /api/kill-switch/run
 *
 * Appelé automatiquement par Vercel Cron (toutes les N minutes, défini dans vercel.json).
 * Authentification par CRON_SECRET dans le header Authorization.
 * Lance le Kill-Switch pour TOUS les utilisateurs qui ont killSwitchEnabled = true.
 *
 * curl -H "Authorization: Bearer $CRON_SECRET" https://app.com/api/kill-switch/run
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Vérifie le secret cron (obligatoire en production)
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runKillSwitchGlobal();

    return NextResponse.json({
      ok:        true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Kill-Switch Cron] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/kill-switch/run
 *
 * Déclenchement manuel depuis l'UI ProfitDash.
 * Authentification par session Supabase (cookie).
 * Lance le Kill-Switch uniquement pour l'utilisateur authentifié.
 */
export async function POST(req: NextRequest) {
  void req; // pas de body requis

  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = await resolveWorkspaceUserId(user.id);

    const result = await runKillSwitchForUser(userId);

    return NextResponse.json({
      ok:        true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Kill-Switch Manual] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
