"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";
import { getSessionPlanId } from "@/lib/plan-access";
import { PLANS } from "@/lib/plans";

/** Upsert a single network account for the logged-in user */
export async function saveAccount(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Not authenticated." };

  const network   = formData.get("network")   as Network;
  const apiKey    = formData.get("apiKey")    as string;
  const apiSecret = formData.get("apiSecret") as string | null;

  if (!network || !apiKey?.trim()) {
    return { error: "API key is required." };
  }

  // ── Plan check: network connection limit ─────────────────────────────────
  const planId = await getSessionPlanId();
  const { networkConnectionLimit } = PLANS[planId];

  if (networkConnectionLimit !== null) {
    // Count existing active accounts (excluding the one being saved = upsert is OK)
    const existing = await prisma.account.count({
      where: { userId: user.id, isActive: true, network: { not: network } },
    });
    if (existing >= networkConnectionLimit) {
      const planLabel = PLANS[planId].label;
      return {
        error: `Your ${planLabel} plan allows ${networkConnectionLimit} network connection${networkConnectionLimit > 1 ? "s" : ""}. Upgrade to connect more networks.`,
      };
    }
  }

  // Ensure shadow User row exists (mirrors Supabase auth.users)
  await prisma.user.upsert({
    where:  { id: user.id },
    update: { email: user.email! },
    create: { id: user.id, email: user.email! },
  });

  const apiKeyEnc    = encrypt(apiKey.trim());
  const apiSecretEnc = apiSecret?.trim() ? encrypt(apiSecret.trim()) : undefined;

  await prisma.account.upsert({
    where:  { userId_network: { userId: user.id, network } },
    create: {
      userId: user.id,
      network,
      apiKeyEnc,
      ...(apiSecretEnc ? { apiSecretEnc } : {}),
      isActive: true,
    },
    update: {
      apiKeyEnc,
      ...(apiSecretEnc !== undefined ? { apiSecretEnc } : {}),
      isActive: true,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/vault");
  return { success: `${network} connected successfully.` };
}

/** Disconnect (deactivate) a network account */
export async function disconnectAccount(network: Network) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Not authenticated." };

  await prisma.account.updateMany({
    where:  { userId: user.id, network },
    data:   { isActive: false },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/vault");
  return { success: `${network} disconnected.` };
}
