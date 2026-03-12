import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import ProfileClient from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accounts, campaigns] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, isActive: true }, select: { network: true } }),
    prisma.campaign.findMany({ where: { userId: user.id }, select: { id: true }, distinct: ["externalId"] }),
  ]);

  return (
    <ProfileClient
      email={user.email ?? ""}
      createdAt={user.created_at}
      networksCount={accounts.length}
      campaignsCount={campaigns.length}
    />
  );
}
