import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { ExoClickAdapter } from "@/lib/adapters/exoclick";
import { Network } from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";

// GET /api/vault?campaignId=xxx  → variations ExoClick d'une campagne
// GET /api/vault                  → liste des campagnes ExoClick de l'utilisateur
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = await resolveWorkspaceUserId(user.id);

    const campaignId = req.nextUrl.searchParams.get("campaignId");

    // ── Compte ExoClick actif de l'utilisateur ────────────────────────────────
    const account = await withTimeout(
      prisma.account.findFirst({
        where: { userId: userId, network: Network.EXOCLICK, isActive: true },
      }),
      null,
      3000,
    );
    if (!account) return NextResponse.json({ error: "No ExoClick account connected" }, { status: 404 });

    const adapter = new ExoClickAdapter(decrypt(account.apiKeyEnc));

    // ── Mode : variations d'une campagne spécifique ───────────────────────────
    if (campaignId) {
      // Vérifie que la campagne appartient bien à l'utilisateur
      const camp = await withTimeout(
        prisma.campaign.findFirst({
          where: { userId: userId, network: Network.EXOCLICK, externalId: campaignId },
          select: { id: true, name: true, externalId: true, status: true },
        }),
        null,
        3000,
      );
      if (!camp) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

      const variations = await adapter.getVariations(campaignId);
      return NextResponse.json({ ok: true, campaign: camp, variations });
    }

    // ── Mode : liste de toutes les campagnes ExoClick ─────────────────────────
    const campaigns = await withTimeout(
      prisma.campaign.findMany({
        where:   { userId: userId, network: Network.EXOCLICK },
        orderBy: { createdAt: "desc" },
        select:  { id: true, name: true, externalId: true, status: true, createdAt: true },
      }),
      [],
      3000,
    );
    return NextResponse.json({ ok: true, campaigns });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/vault]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
