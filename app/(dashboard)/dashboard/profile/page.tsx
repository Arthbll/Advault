import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { withTimeout } from "@/lib/db";
import ProfileClient from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accounts, campaigns] = await Promise.all([
    withTimeout(
      prisma.account.findMany({ where: { userId: user.id, isActive: true }, select: { network: true } }),
      [],
      3000,
    ),
    withTimeout(
      prisma.campaign.findMany({ where: { userId: user.id }, select: { id: true }, distinct: ["externalId"] }),
      [],
      3000,
    ),
  ]);

  const displayName: string =
    (user.user_metadata?.display_name as string | undefined) ?? "";

  const bio = (user.user_metadata?.bio as string | undefined) ?? "";

  const role = (user.user_metadata?.role as string | undefined) ?? "Admin";

  return (
    <ProfileClient
      email={user.email ?? ""}
      displayName={displayName}
      bio={bio}
      createdAt={user.created_at}
      networksCount={accounts.length}
      campaignsCount={campaigns.length}
      role={role}
    />
  );
}
