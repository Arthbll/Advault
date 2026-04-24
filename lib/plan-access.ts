/**
 * lib/plan-access.ts
 *
 * Helpers serveur pour vérifier les droits d'accès par plan.
 * Utilisé uniquement dans les API routes (côté serveur Node.js).
 */

import { createClient } from "@/lib/supabase/server";
import { prisma }        from "@/lib/prisma";
import { normalizePlanId, PLANS, PlanId } from "@/lib/plans";
import { CampaignStatus } from "@prisma/client";

/** Récupère le planId de l'utilisateur connecté depuis ses métadonnées Supabase */
export async function getSessionPlanId(): Promise<PlanId> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "observer";
  const meta = (user.user_metadata as Record<string, unknown> | null) ?? {};
  return normalizePlanId(meta.plan as string | undefined);
}

/** Vérifie si l'utilisateur peut créer une nouvelle campagne selon son plan */
export async function checkCampaignLimit(userId: string, planId: PlanId): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const limit = PLANS[planId].campaignLimit;

  // Dominion = illimité, pas besoin de compter
  if (limit === Infinity) {
    return { allowed: true, current: 0, limit: Infinity };
  }

  // Compte les campagnes actives (hors ARCHIVED et KILLED)
  const current = await prisma.campaign.count({
    where: {
      userId,
      status: {
        notIn: [CampaignStatus.ARCHIVED, CampaignStatus.KILLED],
      },
    },
  });

  return { allowed: current < limit, current, limit };
}
