import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { resetDemoWorkspace } from "@/lib/demo/reset";
import { isDemoModeEnabled } from "@/lib/demo/config";

export const maxDuration = 30;

/**
 * POST /api/demo/reset
 *
 * Supprime le user démo et toutes ses données (cascade Prisma).
 * Double garde : DEMO_MODE_ENABLED + ADMIN_EMAIL.
 *
 * À utiliser avant un git revert du mode démo pour ne rien laisser en base.
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
    const result = await resetDemoWorkspace();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Demo Reset] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
