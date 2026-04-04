/**
 * GET /api/user/status
 * Returns quick onboarding status: hasAccounts, hasCampaigns
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ hasAccounts: false, hasCampaigns: false });

    const [accountCount, campaignCount] = await Promise.all([
      prisma.account.count({ where: { userId: user.id, isActive: true } }),
      prisma.campaign.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      hasAccounts:  accountCount  > 0,
      hasCampaigns: campaignCount > 0,
    });
  } catch {
    return NextResponse.json({ hasAccounts: false, hasCampaigns: false });
  }
}
