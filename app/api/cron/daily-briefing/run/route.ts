import { NextRequest, NextResponse } from "next/server";
import { sendTestDailyBriefing } from "@/lib/email/daily-briefing";

// Vercel cron jobs ont jusqu'à 300s sur Pro, 10s sur Hobby
export const maxDuration = 60;

/**
 * GET /api/cron/daily-briefing/run
 *
 * Appelé automatiquement par Vercel Cron à 07h00 UTC chaque jour
 * (= 09h00 Paris en heure d'été, 08h00 Paris en heure d'hiver).
 *
 * MVP actuel :
 *   - Envoie le briefing de TEST (données bidon Dating) à ADMIN_EMAIL.
 *   - Pas encore branché sur Prisma / vrais utilisateurs — c'est l'étape suivante
 *     une fois que la tuyauterie aura prouvé qu'elle fonctionne en prod.
 *
 * Authentification par CRON_SECRET dans le header Authorization.
 * Vercel Cron ajoute automatiquement ce header depuis la variable d'env
 * CRON_SECRET côté projet Vercel.
 *
 * curl -H "Authorization: Bearer $CRON_SECRET" https://app.com/api/cron/daily-briefing/run
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET obligatoire — si absent, la route est désactivée
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_EMAIL manquant côté Vercel" },
      { status: 500 },
    );
  }

  try {
    const result = await sendTestDailyBriefing(adminEmail, "Arthur");

    if ("error" in result) {
      console.error("[Daily Briefing Cron] Resend error:", result.error);
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      resendId: result.id,
      sentTo: adminEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Daily Briefing Cron] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
