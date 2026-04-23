import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { simulateTick, simulateOneDay } from "@/lib/demo/simulator";
import { isDemoModeEnabled } from "@/lib/demo/config";

export const maxDuration = 60;

/**
 * POST /api/demo/simulate-tick
 *
 * Déclenchement manuel du simulator démo depuis l'UI admin.
 * Double garde :
 *   1. DEMO_MODE_ENABLED=true côté Vercel
 *   2. Utilisateur authentifié = ADMIN_EMAIL (Arthur)
 *
 * Body JSON (optionnel) :
 *   { "mode": "tick" | "day" }  // default "tick"
 *
 * "tick" = ~1h de trafic simulé
 * "day"  = 24 ticks d'un coup (utile pour les tests rapides)
 */
export async function POST(req: NextRequest) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      { error: "Demo mode disabled" },
      { status: 503 },
    );
  }

  const supabase = await createSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let mode: "tick" | "day" = "tick";
  try {
    const body = (await req.json()) as { mode?: "tick" | "day" };
    if (body.mode === "day") mode = "day";
  } catch {
    // pas de body → mode par défaut
  }

  try {
    const result = mode === "day" ? await simulateOneDay() : await simulateTick();
    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Demo Simulator] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
