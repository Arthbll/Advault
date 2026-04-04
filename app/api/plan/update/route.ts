/**
 * POST /api/plan/update
 * Body: { plan: "Observer" | "Operator" | "Dominion" | "Command" }
 *
 * Updates the authenticated user's plan in Supabase user_metadata.
 * Requires the SUPABASE_SERVICE_ROLE_KEY env variable.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const VALID_PLANS = ["Observer", "Operator", "Dominion", "Command"] as const;
type Plan = (typeof VALID_PLANS)[number];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { plan?: string };
  const plan = body.plan as Plan | undefined;
  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 501 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, plan },
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan });
}
