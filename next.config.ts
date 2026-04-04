import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma uses native binaries — tell Turbopack/webpack not to bundle it
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
