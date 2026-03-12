import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter, ExoClickCreateParams } from "@/lib/adapters/exoclick";
import { Network, CampaignStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const supabase = await createSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ExoClickCreateParams & { network: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 }); }

  const { network, ...params } = body;

  if (!network) return NextResponse.json({ error: "Réseau requis" }, { status: 400 });
  if (!params.name?.trim()) return NextResponse.json({ error: "Nom de campagne requis" }, { status: 400 });
  if (!params.bid || params.bid <= 0) return NextResponse.json({ error: "Enchère invalide" }, { status: 400 });

  // Load account
  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: network as Network, isActive: true },
  });
  if (!account) return NextResponse.json({ error: `Aucun compte ${network} connecté` }, { status: 404 });

  const apiKey = decrypt(account.apiKeyEnc);

  try {
    if (network === Network.EXOCLICK) {
      const adapter = new ExoClickAdapter(apiKey);
      const created = await adapter.createCampaign(params);

      // Save in DB
      const today = new Date().toISOString().slice(0, 10);
      const camp = await prisma.campaign.create({
        data: {
          userId:      user.id,
          accountId:   account.id,
          externalId:  created.id,
          name:        created.name,
          network:     Network.EXOCLICK,
          status:      params.active ? CampaignStatus.ACTIVE : CampaignStatus.PAUSED,
          spend:       0,
          revenue:     0,
          impressions: 0,
          clicks:      0,
          conversions: 0,
          dateFrom:    new Date(today),
          dateTo:      new Date(today),
          syncedAt:    new Date(),
        },
      });

      await prisma.log.create({
        data: {
          userId:  user.id,
          type:    "CAMPAIGN_ACTION",
          message: `Campagne créée sur ExoClick : "${created.name}" (ID ${created.id})`,
          metadata: { network: "EXOCLICK", externalId: created.id },
        },
      });

      return NextResponse.json({ ok: true, campaign: { id: camp.id, externalId: created.id, name: created.name } });
    }

    return NextResponse.json({ error: `Réseau non supporté pour la création : ${network}` }, { status: 400 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
