import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import SettingsPageClient from "@/components/settings/SettingsPageClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [accounts, userSettings] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, select: { network: true, isActive: true } }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <SettingsPageClient
      connectedCount={accounts.filter(a => a.isActive).length}
      ksSettings={{
        killSwitchEnabled:    userSettings?.killSwitchEnabled    ?? false,
        roiThreshold:         userSettings?.roiThreshold         ?? -50,
        maxSpendPerCampaign:  userSettings?.maxSpendPerCampaign  ?? null,
        checkIntervalMinutes: userSettings?.checkIntervalMinutes ?? 30,
      }}
    />
  );
}
