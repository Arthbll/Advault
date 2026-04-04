import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { Network } from "@prisma/client";

// POST /api/vault/inject
// Body: { campaignId: string, urls: string[] }
// Injecte plusieurs URLs d'un coup dans une campagne ExoClick
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { campaignId?: string; urls?: string[] };
    const { campaignId, urls } = body;

    if (!campaignId) return NextResponse.json({ error: "campaignId requis" }, { status: 400 });
    if (!Array.isArray(urls) || urls.length === 0)
      return NextResponse.json({ error: "urls[] requis" }, { status: 400 });

    // Vérifie que la campagne appartient à l'utilisateur
    const camp = await prisma.campaign.findFirst({
      where: { userId: user.id, network: Network.EXOCLICK, externalId: campaignId },
    });
    if (!camp) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    // Compte ExoClick
    const account = await prisma.account.findFirst({
      where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
    });
    if (!account) return NextResponse.json({ error: "No ExoClick account connected" }, { status: 404 });

    const adapter = new ExoClickAdapter(decrypt(account.apiKeyEnc));
    const result  = await adapter.addVariations(campaignId, urls);

    // Log
    await prisma.log.create({
      data: {
        userId:  user.id,
        type:    "CAMPAIGN_ACTION",
        message: `${result.success} variation(s) injectée(s) dans la campagne "${camp.name}" (ExoClick ID ${campaignId})`,
        metadata: { network: "EXOCLICK", campaignId, injected: result.success, errors: result.errors },
      },
    });

    return NextResponse.json({ ok: true, ...result });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/vault/inject]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
