import { NextRequest, NextResponse } from "next/server";
import { buildDailyBriefingHtml, sendTestDailyBriefing } from "@/lib/email/daily-briefing";
import { getResendClient, getDefaultFromAddress } from "@/lib/email/resend-client";
import { seedDemoWorkspace } from "@/lib/demo/seed";
import { simulateOneDay } from "@/lib/demo/simulator";
import { buildDemoBriefingData } from "@/lib/demo/briefing-data";
import { isDemoModeEnabled } from "@/lib/demo/config";

export const maxDuration = 60;

/**
 * GET /api/cron/daily-briefing/run
 *
 * Appelé automatiquement par Vercel Cron à 07h00 UTC chaque jour
 * (= 09h00 Paris en heure d'été, 08h00 Paris en heure d'hiver).
 *
 * Comportement selon DEMO_MODE_ENABLED :
 *
 *   1. DEMO_MODE_ENABLED=true  → chemin démo vivant :
 *        a. seed du workspace démo si inexistant (idempotent)
 *        b. simulateOneDay() — 24h de trafic simulé
 *        c. lecture des données réelles du user démo
 *        d. envoi du briefing à ADMIN_EMAIL avec ces données
 *
 *   2. sinon                   → fallback test :
 *        envoi du briefing de démonstration avec données hardcodées.
 *
 * Authentification par CRON_SECRET dans le header Authorization.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
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

  // ── Chemin DÉMO VIVANT ──────────────────────────────────────────────────────
  if (isDemoModeEnabled()) {
    try {
      // 1. Garantit que le workspace démo existe (idempotent)
      const seed = await seedDemoWorkspace();

      // 2. Simule 24h de trafic → stats évoluent, conversions arrivent, engine décide
      const tick = await simulateOneDay();

      // 3. Lit les données réelles du user démo et construit le BriefingData
      const data = await buildDemoBriefingData();
      if (!data) {
        return NextResponse.json(
          { ok: false, error: "Démo user introuvable après seed" },
          { status: 500 },
        );
      }

      // 4. Génère le HTML et envoie
      const html = buildDailyBriefingHtml(data);
      const resend = getResendClient();
      const result = await resend.emails.send({
        from:    getDefaultFromAddress(),
        to:      adminEmail,
        subject: `[DÉMO] ProfitDash — Briefing du matin · ${data.dateStr}`,
        html,
      });

      if (result.error) {
        console.error("[Daily Briefing Cron — DEMO] Resend error:", result.error);
        return NextResponse.json(
          { ok: false, error: String(result.error.message ?? result.error) },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok:        true,
        path:      "demo",
        timestamp: new Date().toISOString(),
        resendId:  result.data?.id ?? "unknown",
        sentTo:    adminEmail,
        seed,
        tick,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Daily Briefing Cron — DEMO] ERREUR:", msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // ── Fallback : mode test avec données hardcodées ────────────────────────────
  try {
    const result = await sendTestDailyBriefing(adminEmail, "Arthur");
    if ("error" in result) {
      console.error("[Daily Briefing Cron — TEST] Resend error:", result.error);
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok:        true,
      path:      "test",
      timestamp: new Date().toISOString(),
      resendId:  result.id,
      sentTo:    adminEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Daily Briefing Cron — TEST] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
