import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("1/3 Adding SECURITY_EVENT to LogType enum…");
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'SECURITY_EVENT'`
    );
    console.log("   ✓ SECURITY_EVENT added (or already exists)");
  } catch (e) {
    console.log("   ! enum:", e.message);
  }

  console.log("2/3 Creating RecoveryCode table…");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RecoveryCode" (
        "id"        TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        "codeHash"  TEXT NOT NULL,
        "usedAt"    TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "RecoveryCode_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    console.log("   ✓ RecoveryCode table created (or already exists)");
  } catch (e) {
    console.log("   ! table:", e.message);
  }

  console.log("3/3 Creating index on RecoveryCode.userId…");
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "RecoveryCode_userId_idx" ON "RecoveryCode"("userId")`
    );
    console.log("   ✓ Index created");
  } catch (e) {
    console.log("   ! index:", e.message);
  }

  console.log("✅ Migration complete.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
