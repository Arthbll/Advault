import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/user/welcome
 *
 * Marks the user as having seen the welcome page.
 * Sets user_metadata.welcomed = true so the auth callback
 * doesn't redirect them there again.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    try {
      const { createClient: adminCreate } = await import("@supabase/supabase-js");
      const admin = adminCreate(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata ?? {}), welcomed: true },
      });
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true });
}
