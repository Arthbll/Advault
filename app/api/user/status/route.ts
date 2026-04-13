/**
 * GET /api/user/status
 * Returns quick onboarding status: hasAccounts, hasCampaigns
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceUserId } from "@/lib/workspace";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ hasAccounts: false, hasCampaigns: false });

    const userId = await resolveWorkspaceUserId(user.id);

    const [accountCount, campaignCount] = await Promise.all([
      prisma.account.count({ where: { userId, isActive: true } }),
      prisma.campaign.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      hasAccounts:  accountCount  > 0,
      hasCampaigns: campaignCount > 0,
    });
  } catch {
    return NextResponse.json({ hasAccounts: false, hasCampaigns: false });
  }
}
