/**
 * GET /api/debug/test-track
 *
 * Simule un postback de conversion pour l'utilisateur connecté.
 * Insère directement une Conversion de test en DB (sans passer par HTTP).
 *
 * Paramètres optionnels :
 *   rev    — montant (défaut: 12.50)
 *   src    — source  (défaut: "test")
 *   cid    — externalId campagne (défaut: première campagne en DB)
 *
 * Usage : GET http://localhost:3000/api/debug/test-track
 *         GET http://localhost:3000/api/debug/test-track?rev=25&src=crakrevenue
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { prisma }                    from "@/lib/prisma";
import { generatePostbackToken }     from "@/lib/postback-token";
import { verifyPostbackToken }       from "@/lib/postback-token";
import { randomUUID }                from "crypto";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rev = parseFloat(searchParams.get("rev") ?? "12.50");
  const src = searchParams.get("src") ?? "test";
  let cid   = searchParams.get("cid") ?? null;

  // Si aucun cid fourni, prendre la première campagne de l'utilisateur
  if (!cid) {
    try {
      const first = await prisma.campaign.findFirst({
        where:   { userId: user.id },
        select:  { externalId: true },
        orderBy: { createdAt: "asc" },
      });
      cid = first?.externalId ?? null;
    } catch { /* ignore */ }
  }

  const token   = generatePostbackToken(user.id);
  const clickId = `test_${randomUUID().slice(0, 8)}`;

  // Vérification du token (même logique que /api/track)
  if (!verifyPostbackToken(user.id, token)) {
    return NextResponse.json({ error: "Token invalide (bug interne)" }, { status: 500 });
  }

  // Insertion directe — évite le fetch HTTP interne qui ne fonctionne pas dans Next.js
  try {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Conversion" ("id", "userId", "campaignId", "clickId", "revenue", "currency", "source", "ip", "createdAt")
      VALUES (
        ${id},
        ${user.id},
        ${cid},
        ${clickId},
        ${rev},
        'USD',
        ${src},
        '127.0.0.1',
        NOW()
      )
    `;

    return NextResponse.json({
      ok: true,
      inserted: { id, userId: user.id, campaignId: cid, clickId, revenue: rev, currency: "USD", source: src },
      token,
      nextStep: "Recharge le dashboard ou /dashboard/conversions pour voir la conversion",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Table pas encore créée ?
    if (msg.includes("Conversion") || msg.includes("relation")) {
      return NextResponse.json({
        error:    "Table Conversion introuvable — visite d'abord /api/debug/migrate-conversions",
        detail:   msg,
      }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur DB", detail: msg }, { status: 500 });
  }
}
