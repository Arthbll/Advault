/**
 * Reset complet du workspace démo.
 *
 * Supprime le user démo → cascade Prisma efface :
 *   - toutes les Campaigns
 *   - toutes les Conversions
 *   - tous les Logs
 *   - l'Account démo
 *   - les UserSettings, DecisionRule, RecoveryCodes
 *
 * Aucune donnée orpheline. Aucune collision possible avec un vrai user.
 *
 * Règle N°4 — documenté, disponible, réversible.
 */

import { prisma } from "@/lib/prisma";
import { DEMO_USER_EMAIL } from "./config";

export async function resetDemoWorkspace(): Promise<{ deleted: boolean; userId?: string }> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) return { deleted: false };

  await prisma.user.delete({
    where: { id: user.id },
  });

  return { deleted: true, userId: user.id };
}
