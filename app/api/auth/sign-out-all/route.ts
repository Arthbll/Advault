/**
 * POST /api/auth/sign-out-all
 * Revokes ALL sessions for the current user via Supabase admin API.
 * This forces every device signed in with this account to log out immediately.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Fallback: sign out current session only
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true, scope: "local" });
  }

  try {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    );
    // Supabase admin: delete all sessions for this user
    await admin.auth.admin.signOut(user.id, "global");
    return NextResponse.json({ ok: true, scope: "global" });
  } catch (e) {
    console.error("[/api/auth/sign-out-all]", e);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
