import { redirect }          from "next/navigation";
import { createClient }       from "@/lib/supabase/server";
import { prisma }             from "@/lib/prisma";
import { DEMO_ACCOUNTS }      from "@/lib/demo-data";
import SettingsPageClient     from "@/components/settings/SettingsPageClient";

export const dynamic = "force-dynamic";

interface MemberRow   { id: string; memberId: string; email: string; role: string; createdAt: string; }
interface InviteRow   { id: string; email: string; token: string; role: string; status: string; expiresAt: string; createdAt: string; }

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const userPlan: string = (meta.plan as string | undefined) ?? "Observer";

  let accounts: { network: string; isActive: boolean }[] = [];
  let userSettings: {
    killSwitchEnabled: boolean;
    roiThreshold: number;
    maxSpendPerCampaign: number | null;
    checkIntervalMinutes: number;
  } | null = null;
  let dbReachable = false;
  let teamMembers: MemberRow[]  = [];
  let pendingInvites: InviteRow[] = [];

  try {
    [accounts, userSettings] = await Promise.all([
      prisma.account.findMany({
        where:  { userId: user.id },
        select: { network: true, isActive: true },
      }),
      prisma.userSettings.findUnique({ where: { userId: user.id } }),
    ]);
    dbReachable = true;

    // Team data (only meaningful for Command plan owners)
    if (userPlan === "Command") {
      [teamMembers, pendingInvites] = await Promise.all([
        prisma.$queryRaw<MemberRow[]>`
          SELECT tm.id, tm."memberId", u.email, tm.role, tm."createdAt"::text
          FROM "TeamMember" tm
          JOIN "User" u ON u.id = tm."memberId"
          WHERE tm."ownerId" = ${user.id}
          ORDER BY tm."createdAt" ASC
        `,
        prisma.$queryRaw<InviteRow[]>`
          SELECT id, email, token, role, status, "expiresAt"::text, "createdAt"::text
          FROM "TeamInvite"
          WHERE "ownerId" = ${user.id} AND status = 'pending'
          ORDER BY "createdAt" DESC
        `,
      ]);
    }
  } catch {
    // DB unreachable
  }

  const isDemo = dbReachable && accounts.length === 0;
  const displayAccounts = isDemo ? DEMO_ACCOUNTS : accounts;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <SettingsPageClient
      connectedCount={displayAccounts.filter(a => a.isActive).length}
      accounts={displayAccounts}
      isDemo={isDemo}
      plan={userPlan}
      ksSettings={{
        killSwitchEnabled:    userSettings?.killSwitchEnabled    ?? false,
        roiThreshold:         userSettings?.roiThreshold         ?? -50,
        maxSpendPerCampaign:  userSettings?.maxSpendPerCampaign  ?? null,
        checkIntervalMinutes: userSettings?.checkIntervalMinutes ?? 30,
      }}
      teamMembers={teamMembers}
      pendingInvites={pendingInvites.map(i => ({ ...i, inviteUrl: `${origin}/invite/${i.token}` }))}
    />
  );
}
