/**
 * GET /api/debug/purge-campaigns
 * Supprime toutes les campagnes de l'utilisateur connecté.
 * Après appel, le dashboard déclenchera automatiquement un backfill.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma }       from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const before = await prisma.campaign.count({ where: { userId: user.id } });
  await prisma.campaign.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({
    ok:      true,
    deleted: before,
    message: `${before} campagne(s) supprimée(s). Recharge le dashboard — la vraie sync ExoClick va démarrer automatiquement.`,
  });
}
