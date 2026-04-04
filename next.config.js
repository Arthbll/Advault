/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma uses native binaries — tell Turbopack/webpack not to bundle it
  serverExternalPackages: ["@prisma/client", "prisma"],
};

module.exports = nextConfig;
