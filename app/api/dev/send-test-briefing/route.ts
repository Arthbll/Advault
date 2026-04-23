import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { sendTestDailyBriefing } from "@/lib/email/daily-briefing";

/**
 * POST /api/dev/send-test-briefing
 *
 * Endpoint de dev — envoie un briefing quotidien de test (données bidon,
 * verticale Dating) à l'utilisateur authentifié. Utilisé pendant le
 * développement pour valider le rendu Gmail et la tuyauterie Resend.
 *
 * Double garde-fou :
 *   1. L'utilisateur doit être connecté (Supabase Auth).
 *   2. L'utilisateur doit être l'ADMIN_EMAIL (Arthur pour l'instant).
 *
 * Après la mise en prod on supprimera cet endpoint — il n'a aucune raison
 * d'exister en production. Règle SaaS : jamais de route de debug en prod.
 */
export async function POST(_req: NextRequest) {
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

  const firstName = user.user_metadata?.full_name?.split(" ")[0] ?? "Arthur";
  const result = await sendTestDailyBriefing(user.email!, firstName);

  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resendId: result.id });
}
