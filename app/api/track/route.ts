/**
 * GET /api/track — Postback universel
 *
 * Reçoit les conversions de n'importe quel réseau CPA (CrakRevenue, MaxBounty…).
 *
 * Paramètres URL :
 *   uid     — userId ProfitDash (UUID Supabase)
 *   token   — HMAC token de l'utilisateur (généré dans Settings > Tracking)
 *   cid     — externalId de la campagne (optionnel, macro {campaign_id})
 *   clickid — clickId du réseau CPA — OBLIGATOIRE pour la déduplication forte
 *   rev     — revenu en USD (float, ex: "12.50")
 *   cur     — devise (optionnel, défaut: USD)
 *   src     — source (ex: "crakrevenue", "maxbounty") — optionnel
 *
 * Déduplication :
 *   Si clickid est fourni  → contrainte UNIQUE en base (atomique, sans race condition)
 *   Si clickid est absent  → pas de dédup possible — la conversion est acceptée telle quelle
 *                            (cas: réseau CPA qui ne passe pas de macro clickid)
 *
 * Rate limiting (soft/silent) :
 *   500 postbacks/minute par token. Au-delà → 200 OK + { limited: true }
 *   + log DB (LogType.POSTBACK_OVERAGE) pour monitoring dans le dashboard.
 *
 * Ordre des opérations intentionnel :
 *   1. Valider token
 *   2. Valider revenu
 *   3. Déduplication en premier — une vraie conversion en burst ne doit jamais
 *      être droppée avant qu'on sache si c'est un doublon
 *   4. Rate limit — appliqué uniquement sur les conversions non-dupliquées
 *   5. Insertion atomique + catch P2002 comme filet de sécurité final
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }              from "@/lib/prisma";
import { verifyPostbackToken } from "@/lib/postback-token";
import { Prisma }              from "@prisma/client";

// ─── Rate limiter in-process ──────────────────────────────────────────────────
// Note: par process Vercel. Sur plusieurs instances, la limite effective est
// RATE_LIMIT * instanceCount — acceptable pour un garde-fou souple.
// Pour un rate limiting distribué précis, migrer vers Upstash Redis (V2).

const RATE_LIMIT_PER_MINUTE = 500;
const WINDOW_MS             = 60_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { limited: boolean; count: number } {
  const now    = Date.now();
  const bucket = rateLimitMap.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false, count: 1 };
  }

  bucket.count++;
  return { limited: bucket.count > RATE_LIMIT_PER_MINUTE, count: bucket.count };
}

// Purge périodique pour éviter les memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap) {
    if (now >= bucket.resetAt) rateLimitMap.delete(key);
  }
}, 120_000);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const uid     = searchParams.get("uid")     ?? "";
  const token   = searchParams.get("token")   ?? "";
  const cid     = searchParams.get("cid")     || null;
  const clickId = searchParams.get("clickid") || null;
  const revRaw  = searchParams.get("rev")     ?? "0";
  const cur     = searchParams.get("cur")     ?? "USD";
  const src     = searchParams.get("src")     || null;

  // ── 1. Validation token ───────────────────────────────────────────────────

  if (!uid || !token) {
    return NextResponse.json({ error: "uid and token parameters are required" }, { status: 400 });
  }

  if (!verifyPostbackToken(uid, token)) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  // ── 2. Validation revenu ──────────────────────────────────────────────────

  const revenue = parseFloat(revRaw);
  if (isNaN(revenue) || revenue < 0) {
    return NextResponse.json({ error: "Revenu invalide" }, { status: 400 });
  }

  // ── 3. Déduplication — EN PREMIER, avant le rate limit ───────────────────
  //
  // Objectif : identifier les vrais doublons avant de les comptabiliser
  // dans le bucket de rate limiting. Une conversion légitime qui arrive
  // en burst ne doit jamais être droppée parce qu'un doublon l'a précédée.
  //
  // Si clickId est absent : pas de dédup possible. On continue sans bloquer.
  // La contrainte UNIQUE en base (@@unique([clickId])) gère les cas limites
  // de race condition pour les clickId présents.

  if (clickId) {
    try {
      const existing = await prisma.conversion.findFirst({
        where:  { clickId },
        select: { id: true },
      });
      if (existing) {
        // Doublon confirmé — on répond 200 sans consommer de slot de rate limit
        return NextResponse.json({ ok: true, duplicate: true });
      }
    } catch {
      // DB unreachable au moment du check — on continue plutôt que de bloquer.
      // La contrainte UNIQUE agira en dernier recours à l'insertion.
    }
  }

  // ── 4. Rate limiting (soft/silent) ────────────────────────────────────────
  //
  // Appliqué APRÈS la dédup : seules les conversions non-dupliquées consomment
  // un slot. Si la limite est dépassée, on répond 200 OK + { limited: true }
  // et on logue en base pour monitoring — jamais de 429 brutal.

  const { limited, count } = checkRateLimit(uid);

  if (limited) {
    // Log en base — visible dans le dashboard et persisté (pas juste console)
    prisma.log.create({
      data: {
        userId:  uid,
        type:    "POSTBACK_OVERAGE" as never,
        message: `Rate limit dépassé — ${count} postbacks/min (seuil: ${RATE_LIMIT_PER_MINUTE})`,
        metadata: {
          count,
          limit:    RATE_LIMIT_PER_MINUTE,
          windowMs: WINDOW_MS,
          src:      src ?? "unknown",
          cid:      cid ?? null,
          hasClickId: !!clickId,
        },
      },
    }).catch(e => console.error("[/api/track] Impossible de logguer l'overage:", e));

    // 200 OK intentionnel : le sender ne doit pas retrier agressivement
    return NextResponse.json({ ok: true, limited: true });
  }

  // ── 5. IP pour audit ──────────────────────────────────────────────────────

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // ── 6. Insertion atomique ─────────────────────────────────────────────────
  //
  // On tente d'insérer directement. Si la contrainte UNIQUE sur clickId
  // est violée (race condition entre deux requêtes simultanées identiques),
  // Prisma lève une PrismaClientKnownRequestError avec code P2002.
  // On l'intercepte et on répond comme un doublon — sans erreur 500.

  try {
    await prisma.conversion.create({
      data: {
        userId:     uid,
        campaignId: cid,
        clickId:    clickId,
        revenue:    revenue,
        currency:   cur.toUpperCase(),
        source:     src,
        ip:         ip,
      },
    });
  } catch (e) {
    // P2002 = unique constraint violation → doublon détecté au niveau DB
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[/api/track] Erreur insertion conversion:", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Indiquer si la conversion a été acceptée sans déduplication possible
  return NextResponse.json({ ok: true, ...(clickId ? {} : { noClickId: true }) });
}
