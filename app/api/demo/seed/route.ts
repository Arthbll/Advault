import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { seedDemoWorkspace } from "@/lib/demo/seed";
import { isDemoModeEnabled } from "@/lib/demo/config";

export const maxDuration = 60;

/**
 * POST /api/demo/seed
 *
 * Crée (ou rafraîchit) le workspace démo.
 * Idempotent — on peut l'appeler N fois, mêmes données à la fin.
 *
 * Double garde : DEMO_MODE_ENABLED + ADMIN_EMAIL.
 */
export async function POST(_req: NextRequest) {
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

  try {
    const result = await seedDemoWorkspace();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Demo Seed] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
