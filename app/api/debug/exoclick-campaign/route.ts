/**
 * Route de debug : GET /api/debug/exoclick-campaign?id=CAMPAIGN_ID
 * Récupère la structure complète d'une campagne ExoClick existante
 * pour connaître le format exact attendu par leur API.
 * À SUPPRIMER avant mise en production.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { Network } from "@prisma/client";

export async function GET(req: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // Récupère le compte ExoClick
  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Pas de compte ExoClick" }, { status: 404 });

  const apiKey  = decrypt(account.apiKeyEnc);
  const adapter = new ExoClickAdapter(apiKey);

  // ID de campagne passé en paramètre, ou prend le premier dispo en DB
  let campaignId = req.nextUrl.searchParams.get("id");

  if (!campaignId) {
    const dbCampaign = await prisma.campaign.findFirst({
      where: { userId: user.id, network: Network.EXOCLICK },
      orderBy: { syncedAt: "desc" },
    });
    campaignId = dbCampaign?.externalId ?? null;
  }

  if (!campaignId) {
    return NextResponse.json({ error: "Aucune campagne ExoClick en base. Passe ?id=TON_ID" }, { status: 404 });
  }

  // Fetch la campagne complète sur ExoClick
  const raw = await adapter.getRawCampaign(campaignId);

  return NextResponse.json({
    note: "Voici la structure exacte d'une campagne ExoClick. Utilise-la comme modèle pour la création.",
    campaignId,
    structure: raw,
  }, { status: 200 });
}
