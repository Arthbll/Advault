import { NextRequest, NextResponse } from "next/server";
import {
  buildDailyBriefingHtml,
  sendDailyBriefingSolo,
  sendTestDailyBriefing,
} from "@/lib/email/daily-briefing";
import { getResendClient, getDefaultFromAddress } from "@/lib/email/resend-client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedDemoWorkspace } from "@/lib/demo/seed";
import { simulateOneDay } from "@/lib/demo/simulator";
import { buildDemoBriefingData } from "@/lib/demo/briefing-data";
import { isDemoModeEnabled, DEMO_USER_EMAIL } from "@/lib/demo/config";

export const maxDuration = 60;

/**
 * GET /api/cron/daily-briefing/run
 *
 * Appelé automatiquement par Vercel Cron à 07h00 UTC chaque jour.
 *
 * Trois chemins selon le contexte :
 *
 *   1. DEMO_MODE_ENABLED=true  → chemin démo vivant :
 *        seed + simulate + envoie le briefing démo à ADMIN_EMAIL
 *
 *   2. sinon, si PRODUCTION_BRIEFING=true → chemin production :
 *        envoie un briefing personnalisé à CHAQUE vrai utilisateur
 *        basé sur ses données Prisma réelles
 *
 *   3. sinon → fallback test :
 *        envoie un briefing de démonstration hardcodé à ADMIN_EMAIL
 *        (utile pendant le développement)
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
      const seed = await seedDemoWorkspace();

      let tick: Awaited<ReturnType<typeof simulateOneDay>> | null = null;
      try {
        tick = await simulateOneDay();
      } catch (simErr) {
        console.error(
          "[Daily Briefing Cron — DEMO] Simulator failed, continuing with seed stats:",
          simErr,
        );
      }

      const data = await buildDemoBriefingData();
      if (!data) {
        return NextResponse.json(
          { ok: false, error: "Démo user introuvable après seed" },
          { status: 500 },
        );
      }

      const html = buildDailyBriefingHtml(data);
      const resend = getResendClient();
      const result = await resend.emails.send({
        from: getDefaultFromAddress(),
        to: adminEmail,
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
        ok: true,
        path: "demo",
        timestamp: new Date().toISOString(),
        resendId: result.data?.id ?? "unknown",
        sentTo: adminEmail,
        seed,
        tick: tick ?? {
          campaignsTouched: 0,
          conversionsAdded: 0,
          killsTriggered: 0,
          scalesTriggered: 0,
          simulatorSkipped: true,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Daily Briefing Cron — DEMO] ERREUR:", msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  }

  // ── Chemin PRODUCTION — envoie un briefing à chaque vrai utilisateur ───────
  const isProduction = process.env.PRODUCTION_BRIEFING === "true";

  if (isProduction) {
    return sendProductionBriefings();
  }

  // ── Fallback TEST — données hardcodées, envoi à adminEmail uniquement ───────
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
      ok: true,
      path: "test",
      timestamp: new Date().toISOString(),
      resendId: result.id,
      sentTo: adminEmail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Daily Briefing Cron — TEST] ERREUR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ─── PRODUCTION BRIEFING ─────────────────────────────────────────────────────

/**
 * Envoie le briefing à tous les vrais utilisateurs qui n'en ont pas encore
 * reçu un aujourd'hui.
 *
 * Idempotence : on vérifie `lastDailyBriefingSentAt` — si l'envoi a déjà eu
 * lieu aujourd'hui (UTC), on passe à l'utilisateur suivant.
 *
 * Multi-tenancy : chaque requête Prisma est filtrée par userId.
 */
async function sendProductionBriefings(): Promise<NextResponse> {
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  // Récupère tous les vrais utilisateurs (hors démo) qui n'ont pas encore
  // reçu leur briefing aujourd'hui
  const users = await prisma.user.findMany({
    where: {
      email: { not: DEMO_USER_EMAIL },
      OR: [
        { lastDailyBriefingSentAt: null },
        { lastDailyBriefingSentAt: { lt: todayUtc } },
      ],
    },
    include: { settings: true },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    return NextResponse.json({
      ok: true,
      path: "production",
      timestamp: new Date().toISOString(),
      sent: 0,
      skipped: 0,
      errors: 0,
      message: "Tous les utilisateurs ont déjà reçu leur briefing aujourd'hui.",
    });
  }

  // Charge les métadonnées Supabase (full_name) pour tous les users en batch
  const supabaseAdmin = createAdminClient();
  const userMetaMap: Record<string, { firstName: string }> = {};

  try {
    // listUsers retourne au maximum 1000 users par page
    // Pour les SaaS avec >1000 users, il faudrait paginer — géré plus tard
    const { data: authData, error } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (!error && authData?.users) {
      for (const authUser of authData.users) {
        const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
        const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
        const firstName = fullName.split(" ")[0]?.trim() || deriveFirstName(authUser.email ?? "");
        userMetaMap[authUser.id] = { firstName };
      }
    } else if (error) {
      console.error("[Daily Briefing Cron — PROD] Supabase admin listUsers error:", error);
      // On continue quand même — on utilisera le fallback email-based firstName
    }
  } catch (err) {
    console.error("[Daily Briefing Cron — PROD] Supabase admin call failed:", err);
    // Fallback silencieux — le cron continue
  }

  let sent = 0;
  let errors = 0;
  const errorDetails: { userId: string; error: string }[] = [];

  // Traite les users séquentiellement pour éviter de surcharger Resend et la DB
  for (const user of users) {
    const timezone = user.settings?.timezone ?? "UTC";
    const meta = userMetaMap[user.id];
    const firstName = meta?.firstName ?? deriveFirstName(user.email);

    try {
      const result = await sendDailyBriefingSolo(
        user.id,
        user.email,
        firstName,
        timezone,
      );

      if ("error" in result) {
        throw new Error(result.error);
      }

      // Marque l'envoi comme réussi pour éviter les doublons
      await prisma.user.update({
        where: { id: user.id },
        data: { lastDailyBriefingSentAt: new Date() },
      });

      // Log en DB pour la traçabilité
      await prisma.log.create({
        data: {
          userId: user.id,
          type: "DAILY_BRIEFING_SENT",
          message: `Briefing envoyé à ${user.email}`,
          metadata: { resendId: result.id, firstName },
        },
      });

      sent++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors++;
      errorDetails.push({ userId: user.id, error: msg });

      // Log l'erreur en DB pour le retry / debugging
      try {
        await prisma.log.create({
          data: {
            userId: user.id,
            type: "DAILY_BRIEFING_ERROR",
            message: `Échec d'envoi du briefing à ${user.email} : ${msg}`,
            metadata: { error: msg },
          },
        });
      } catch {
        // Si même le log échoue, on ne bloque pas le reste
      }

      console.error(
        `[Daily Briefing Cron — PROD] Erreur pour user ${user.id} (${user.email}):`,
        msg,
      );
    }
  }

  return NextResponse.json({
    ok: errors === 0,
    path: "production",
    timestamp: new Date().toISOString(),
    total: users.length,
    sent,
    errors,
    ...(errorDetails.length > 0 && { errorDetails }),
  });
}

/**
 * Dérive un prénom lisible depuis une adresse email.
 * Exemple : "arthur.bonelli@gmail.com" → "Arthur"
 */
function deriveFirstName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const firstSegment = localPart.split(/[._-]/)[0] ?? localPart;
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1).toLowerCase();
}
