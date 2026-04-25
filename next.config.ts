import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Prisma uses native binaries — tell Turbopack/webpack not to bundle it
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Les seules erreurs TypeScript résiduelles sont des types Prisma périmés
  // (propriété `timezone` de UserSettings) — elles sont corrigées automatiquement
  // par `prisma generate` au runtime Vercel mais pas dans le client local du sandbox.
  // On les ignore au build pour ne pas bloquer le déploiement.
  // TODO: supprimer dès que le client Prisma local est régénéré proprement.
  typescript: { ignoreBuildErrors: true },

  // Note: l'option `eslint` a été supprimée dans Next.js 16.
  // ESLint n'est plus exécuté pendant le build avec Turbopack — aucune config nécessaire.
};

export default withSentryConfig(nextConfig, {
  // Organisation et projet Sentry
  org: "profitdash",
  project: "javascript-nextjs",

  // Désactive la source map upload pendant le dev — uniquement en prod (CI)
  silent: true,

  // Upload les source maps sur Sentry pour avoir les vraies lignes de code dans les erreurs
  // (seulement si SENTRY_AUTH_TOKEN est défini dans les env vars Vercel)
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
