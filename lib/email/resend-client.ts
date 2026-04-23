import { Resend } from "resend";

// Singleton — évite de recréer un client Resend à chaque appel en dev
// (même pattern que lib/prisma.ts).
const globalForResend = globalThis as unknown as { resend?: Resend };

/**
 * Retourne un client Resend prêt à l'emploi.
 *
 * Lance une erreur explicite si RESEND_API_KEY est absent — c'est volontaire :
 * on préfère cracher fort au démarrage plutôt que de laisser passer un envoi
 * silencieux qui échouera côté Resend sans log clair.
 */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY manquant. Vérifier .env.local (dev) ou les env vars Vercel (prod).",
    );
  }

  if (!globalForResend.resend) {
    globalForResend.resend = new Resend(apiKey);
  }

  return globalForResend.resend;
}

/**
 * Adresse d'envoi par défaut — lue depuis EMAIL_FROM.
 *
 * En dev : onboarding@resend.dev (fournie par Resend, aucune vérif domaine).
 * En prod : à remplacer par une adresse sur un domaine vérifié (ex. no-reply@profitdash.app).
 */
export function getDefaultFromAddress(): string {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error(
      "EMAIL_FROM manquant. Vérifier .env.local (dev) ou les env vars Vercel (prod).",
    );
  }

  return from;
}
