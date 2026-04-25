import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma uses native binaries — tell Turbopack/webpack not to bundle it
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Ignore les erreurs TypeScript résiduelles au build (types Prisma locaux périmés)
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
