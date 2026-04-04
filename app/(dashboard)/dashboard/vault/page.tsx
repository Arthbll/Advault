import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/db";
import { Network } from "@prisma/client";
import VaultClient from "@/components/vault/VaultClient";

export default async function VaultPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [campaigns, hasExoClick] = await Promise.all([
    withTimeout(
      prisma.campaign.findMany({
        where:   { userId: user.id, network: Network.EXOCLICK },
        orderBy: { createdAt: "desc" },
        select:  { id: true, name: true, externalId: true, status: true, createdAt: true },
      }),
      [],
      3000,
    ),
    withTimeout(
      prisma.account.findFirst({
        where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
      }),
      null,
      3000,
    ),
  ]);

  return (
    <VaultClient
      campaigns={campaigns.map(c => ({
        id:         c.id,
        name:       c.name,
        externalId: c.externalId,
        status:     c.status,
        createdAt:  c.createdAt.toISOString(),
      }))}
      hasExoClick={!!hasExoClick}
    />
  );
}
