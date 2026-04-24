/**
 * GET /api/campaigns/count
 *
 * Retourne le nombre de campagnes actives de l'utilisateur
 * et sa limite selon son plan. Utilisé par le frontend pour
 * afficher "X / Y campagnes utilisées".
 */

import { NextResponse }            from "next/server";
import { createClient }            from "@/lib/supabase/server";
import { prisma }                  from "@/lib/prisma";
import { resolveWorkspaceUserId }  from "@/lib/workspace";
import { getSessionPlanId, checkCampaignLimit } from "@/lib/plan-access";
import { CampaignStatus }          from "@prisma/client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const planId = await getSessionPlanId();

  const current = await prisma.campaign.count({
    where: {
      userId,
      status: { notIn: [CampaignStatus.ARCHIVED, CampaignStatus.KILLED] },
    },
  });

  const { limit } = await checkCampaignLimit(userId, planId);

  return NextResponse.json({ current, limit, planId });
}
