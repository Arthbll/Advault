import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import VaultClient from "@/components/vault/VaultClient";
import { Network } from "@prisma/client";

export default async function VaultPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { network: true, isActive: true },
  });

  const connectedMap = Object.fromEntries(
    accounts.map(a => [a.network, a.isActive])
  ) as Record<string, boolean>;

  return <VaultClient connectedMap={connectedMap} />;
}
