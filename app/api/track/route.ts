/**
 * GET /api/track
 *
 * Postback universel — reçoit les conversions de n'importe quel réseau CPA.
 *
 * Paramètres URL :
 *   token  — HMAC token de l'utilisateur (généré dans Settings > Tracking)
 *   uid    — userId ProfitDash (UUID Supabase)
 *   cid    — externalId de la campagne (optionnel, passé via macro {campaign_id})
 *   clickid— clickId du réseau CPA pour la déduplication (optionnel)
 *   rev    — revenu en USD (float, ex: "12.50")
 *   cur    — devise (optionnel, défaut: USD)
 *   src    — source (ex: "crakrevenue", "maxbounty") — optionnel
 *
 * Réponse :
 *   200 OK  — { ok: true }
 *   400     — { error: "..." }
 *   401     — { error: "Token invalide" }
 *
 * Exemple URL CrakRevenue :
 *   https://app.profitdash.io/api/track?uid={profitdash_uid}&token={profitdash_token}&cid={campaign_id}&clickid={clickid}&rev={payout}&src=crakrevenue
 *
 * Note: utilise $queryRaw / $executeRaw car la table Conversion a été créée via migration SQL
 * (voir /api/debug/migrate-conversions) et n'est pas encore dans le client Prisma généré.
 * Après `npx prisma generate`, les méthodes typées seront disponibles.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { verifyPostbackToken }       from "@/lib/postback-token";
import { randomUUID }                from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const uid     = searchParams.get("uid")     ?? "";
  const token   = searchParams.get("token")   ?? "";
  const cid     = searchParams.get("cid")     || null;
  const clickId = searchParams.get("clickid") || null;
  const revRaw  = searchParams.get("rev")     ?? "0";
  const cur     = searchParams.get("cur")     ?? "USD";
  const src     = searchParams.get("src")     || null;

  // ── Validation ────────────────────────────────────────────────────────────

  if (!uid || !token) {
    return NextResponse.json({ error: "uid and token parameters are required" }, { status: 400 });
  }

  if (!verifyPostbackToken(uid, token)) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const revenue = parseFloat(revRaw);
  if (isNaN(revenue) || revenue < 0) {
    return NextResponse.json({ error: "Revenu invalide" }, { status: 400 });
  }

  // ── Déduplication sur clickId ─────────────────────────────────────────────

  if (clickId) {
    try {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Conversion" WHERE "clickId" = ${clickId} LIMIT 1
      `;
      if (rows.length > 0) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    } catch {
      // DB unreachable — on laisse passer pour ne pas bloquer le réseau CPA
    }
  }

  // ── IP pour audit ─────────────────────────────────────────────────────────

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // ── Insertion ─────────────────────────────────────────────────────────────

  try {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Conversion" ("id", "userId", "campaignId", "clickId", "revenue", "currency", "source", "ip", "createdAt")
      VALUES (
        ${id},
        ${uid},
        ${cid},
        ${clickId},
        ${revenue},
        ${cur.toUpperCase()},
        ${src},
        ${ip},
        NOW()
      )
    `;
  } catch (e) {
    console.error("[/api/track] Erreur insertion conversion:", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
