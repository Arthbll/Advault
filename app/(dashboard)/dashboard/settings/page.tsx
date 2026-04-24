import { redirect }          from "next/navigation";
import { createClient }       from "@/lib/supabase/server";
import { prisma }             from "@/lib/prisma";
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

  // Stripe data from DB
  let stripeData = {
    planId: "observer",
    subscriptionStatus: null as string | null,
    periodEnd: null as string | null,
    hasSubscription: false,
    prices: {
      operatorMonthly: process.env.STRIPE_PRICE_OPERATOR_MONTHLY ?? "",
      operatorAnnual:  process.env.STRIPE_PRICE_OPERATOR_ANNUAL  ?? "",
      dominionMonthly: process.env.STRIPE_PRICE_DOMINION_MONTHLY ?? "",
      dominionAnnual:  process.env.STRIPE_PRICE_DOMINION_ANNUAL  ?? "",
    },
  };

  let accounts: { network: string; isActive: boolean }[] = [];
  let userSettings: {
    killSwitchEnabled: boolean;
    roiThreshold: number;
    maxSpendPerCampaign: number | null;
    checkIntervalMinutes: number;
  } | null = null;
  let wsTimezone = "UTC";
  let wsCurrency = "USD";
  let dbReachable = false;
  let teamMembers: MemberRow[]  = [];
  let pendingInvites: InviteRow[] = [];

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (dbUser) {
      stripeData = {
        ...stripeData,
        planId:             dbUser.planId ?? "observer",
        subscriptionStatus: dbUser.stripeSubscriptionStatus ?? null,
        periodEnd:          dbUser.planCurrentPeriodEnd?.toISOString() ?? null,
        hasSubscription:    !!dbUser.stripeSubscriptionId && dbUser.stripeSubscriptionStatus === "active",
      };
    }

    [accounts, userSettings] = await Promise.all([
      prisma.account.findMany({
        where:  { userId: user.id },
        select: { network: true, isActive: true },
      }),
      prisma.userSettings.findUnique({ where: { userId: user.id } }),
    ]);
    dbReachable = true;

    // Workspace preferences (timezone, currency) via raw query (new columns)
    try {
      const wsRows = await prisma.$queryRaw<{ timezone: string; currency: string }[]>`
        SELECT timezone, currency FROM "UserSettings" WHERE "userId" = ${user.id} LIMIT 1
      `;
      if (wsRows.length > 0) {
        wsTimezone = wsRows[0].timezone ?? "UTC";
        wsCurrency = wsRows[0].currency ?? "USD";
      }
    } catch { /* columns not yet migrated */ }

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

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <SettingsPageClient
      connectedCount={accounts.filter(a => a.isActive).length}
      accounts={accounts}
      plan={userPlan}
      ksSettings={{
        killSwitchEnabled:    userSettings?.killSwitchEnabled    ?? false,
        roiThreshold:         userSettings?.roiThreshold         ?? -50,
        maxSpendPerCampaign:  userSettings?.maxSpendPerCampaign  ?? null,
        checkIntervalMinutes: userSettings?.checkIntervalMinutes ?? 30,
      }}
      teamMembers={teamMembers}
      pendingInvites={pendingInvites.map(i => ({ ...i, inviteUrl: `${origin}/invite/${i.token}` }))}
      timezone={wsTimezone}
      currency={wsCurrency}
      stripeData={stripeData}
    />
  );
}
