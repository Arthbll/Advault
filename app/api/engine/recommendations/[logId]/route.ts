/**
 * POST /api/engine/recommendations/[logId]
 *
 * Exécute la décision d'un utilisateur sur une recommandation du Decision Engine.
 *
 * Body: { decision: "approve" | "ignore" }
 *
 * Approve → exécute la vraie action sur le réseau publicitaire (kill ou scale)
 *           puis log RECOMMENDATION_APPROVED en DB.
 *
 * Ignore  → log RECOMMENDATION_IGNORED en DB, aucun appel réseau.
 *
 * Sécurité :
 *   - Auth Supabase obligatoire
 *   - Le Log doit appartenir au userId (multi-tenancy)
 *   - Seuls les types DECISION_KILL / DECISION_SCALE / KILL_SWITCH_TRIGGERED
 *     peuvent être approuvés (pas les WATCH, pas les autres types)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { prisma }                    from "@/lib/prisma";
import { decrypt }                   from "@/lib/crypto";
import { resolveWorkspaceUserId }    from "@/lib/workspace";
import { assertCanMutate }           from "@/lib/team-role";
import { ExoClickAdapter }           from "@/lib/adapters/exoclick";
import { TrafficStarsAdapter }       from "@/lib/adapters/trafficstars";
import { TrafficJunkyAdapter }       from "@/lib/adapters/trafficjunky";
import * as PropellerAds             from "@/lib/adapters/propellerads";
import * as Adsterra                 from "@/lib/adapters/adsterra";
import { Network, CampaignStatus, LogType } from "@prisma/client";

const APPROVABLE_TYPES = [
  "DECISION_KILL",
  "DECISION_SCALE",
  "KILL_SWITCH_TRIGGERED",
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const viewerBlock = await assertCanMutate(user.id);
  if (viewerBlock) return viewerBlock;

  const userId = await resolveWorkspaceUserId(user.id);

  const { logId } = await params;
  const body = await req.json() as { decision?: string };
  const decision = body.decision;

  if (decision !== "approve" && decision !== "ignore") {
    return NextResponse.json(
      { error: "decision doit être 'approve' ou 'ignore'" },
      { status: 400 },
    );
  }

  // ── Trouver le log de recommandation ────────────────────────────────────
  const log = await prisma.log.findFirst({
    where: { id: logId, userId },
    include: {
      campaign: {
        include: { account: true },
      },
    },
  });

  if (!log) {
    return NextResponse.json({ error: "Recommandation introuvable" }, { status: 404 });
  }

  // Vérifier que c'est bien un type approvable
  if (!APPROVABLE_TYPES.includes(log.type as typeof APPROVABLE_TYPES[number])) {
    return NextResponse.json(
      { error: `Type '${log.type}' ne peut pas être approuvé` },
      { status: 400 },
    );
  }

  const meta = (log.metadata ?? {}) as Record<string, unknown>;

  // ── IGNORE — aucun appel réseau, juste un log ────────────────────────────
  if (decision === "ignore") {
    await prisma.log.create({
      data: {
        userId,
        campaignId: log.campaignId,
        type:       "RECOMMENDATION_IGNORED" as LogType,
        message:    `[IGNORED] Recommandation ignorée — "${meta.campaignName ?? log.campaignId}"`,
        metadata: {
          originalLogId:  log.id,
          originalType:   log.type,
          campaignName:   (meta.campaignName as string | null) ?? null,
          network:        (meta.network as string | null) ?? null,
          roi:            (meta.roi as number | null) ?? null,
          ignoredAt:      new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, decision: "ignore" });
  }

  // ── APPROVE — on exécute la vraie action sur le réseau ──────────────────
  if (!log.campaign || !log.campaign.account) {
    // Peut arriver si la campagne a été supprimée entre-temps
    return NextResponse.json(
      { error: "Campagne associée introuvable — impossible d'exécuter l'action" },
      { status: 404 },
    );
  }

  const campaign = log.campaign;
  const account  = campaign.account;

  try {
    const apiKey        = decrypt(account.apiKeyEnc);
    const sessionCookie = account.apiSecretEnc
      ? decrypt(account.apiSecretEnc)
      : undefined;

    const isKill  = log.type === "DECISION_KILL" || log.type === "KILL_SWITCH_TRIGGERED";
    const isScale = log.type === "DECISION_SCALE";

    // ── Appel réseau ────────────────────────────────────────────────────────
    if (isKill) {
      if (campaign.network === Network.EXOCLICK) {
        await new ExoClickAdapter(apiKey).pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICSTARS) {
        await new TrafficStarsAdapter(apiKey).pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        await new TrafficJunkyAdapter(apiKey).pauseCampaign(campaign.externalId);
      } else if (campaign.network === Network.PROPELLERADS) {
        await PropellerAds.pauseCampaign(apiKey, campaign.externalId);
      } else if (campaign.network === Network.ADSTERRA) {
        await Adsterra.pauseCampaign(apiKey, campaign.externalId);
      }

      // Mettre à jour le statut en DB
      await prisma.campaign.updateMany({
        where: { externalId: campaign.externalId, userId },
        data:  { status: CampaignStatus.KILLED },
      });

    } else if (isScale) {
      const bidMult = 1.25; // +25% par défaut, configurable plus tard
      if (campaign.network === Network.EXOCLICK) {
        await new ExoClickAdapter(apiKey).scaleBid(campaign.externalId, bidMult);
      } else if (campaign.network === Network.TRAFFICSTARS) {
        await new TrafficStarsAdapter(apiKey).scaleBid(campaign.externalId, bidMult);
      } else if (campaign.network === Network.TRAFFICJUNKY) {
        await new TrafficJunkyAdapter(apiKey).scaleBid(campaign.externalId, bidMult);
      } else if (campaign.network === Network.PROPELLERADS) {
        await PropellerAds.scaleBid(apiKey, campaign.externalId, bidMult);
      } else if (campaign.network === Network.ADSTERRA) {
        await Adsterra.scaleBid(apiKey, campaign.externalId, bidMult, sessionCookie);
      }
    }

    // ── Log de l'approbation ────────────────────────────────────────────────
    await prisma.log.create({
      data: {
        userId,
        campaignId: log.campaignId,
        type:       "RECOMMENDATION_APPROVED" as LogType,
        message:    `[APPROVED] ${isKill ? "Kill" : "Scale"} approuvé — "${campaign.name}" (${campaign.network})`,
        metadata: {
          originalLogId: log.id,
          originalType:  log.type,
          campaignName:  campaign.name,
          network:       campaign.network,
          roi:           (meta.roi as number | null) ?? null,
          action:        isKill ? "kill" : "scale",
          approvedAt:    new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      ok:       true,
      decision: "approve",
      action:   isKill ? "kill" : "scale",
      campaign: campaign.name,
      network:  campaign.network,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Log l'erreur pour debugging
    await prisma.log.create({
      data: {
        userId,
        campaignId: log.campaignId,
        type:       "RECOMMENDATION_APPROVED" as LogType,
        message:    `[APPROVE_ERROR] Échec d'exécution — "${campaign.name}": ${msg}`,
        metadata: {
          originalLogId: log.id,
          error:         msg,
          approvedAt:    new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
