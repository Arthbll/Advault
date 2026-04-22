/**
 * POST /api/team/invite
 * Body: { email: string; role?: "viewer" | "editor" }
 *
 * Creates a TeamInvite record for the authenticated Command-plan owner.
 * Returns { inviteUrl } — the owner copies and shares this link.
 * (Email sending can be added once SUPABASE_SERVICE_ROLE_KEY is configured.)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface InviteRow {
  id: string;
  token: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only Command-plan owners can invite
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if ((meta.plan as string) !== "Command") {
    return NextResponse.json({ error: "Command plan required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { email?: string; role?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const role = body.role === "viewer" ? "viewer" : "editor";

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Check for existing pending invite for this email
  let existing: InviteRow[];
  try {
    existing = await prisma.$queryRaw<InviteRow[]>`
      SELECT id, token FROM "TeamInvite"
      WHERE "ownerId" = ${user.id} AND email = ${email} AND status = 'pending'
      LIMIT 1
    `;
  } catch (e) {
    console.error("[/api/team/invite] DB error (check):", e);
    return NextResponse.json({ error: "Database error: " + String(e) }, { status: 500 });
  }

  if (existing.length > 0) {
    return NextResponse.json({
      ok: true,
      inviteUrl: `${origin}/invite/${existing[0].token}`,
      alreadyExists: true,
    });
  }

  // Create new invite (expires in 7 days)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let created: InviteRow[];
  try {
    created = await prisma.$queryRaw<InviteRow[]>`
      INSERT INTO "TeamInvite" (id, "ownerId", email, token, role, "expiresAt")
      VALUES (gen_random_uuid(), ${user.id}, ${email}, gen_random_uuid(), ${role}, ${expiresAt}::timestamptz)
      RETURNING id, token
    `;
  } catch (e) {
    console.error("[/api/team/invite] DB error (insert):", e);
    return NextResponse.json({ error: "Database error: " + String(e) }, { status: 500 });
  }

  const token = created[0].token;
  const inviteUrl = `${origin}/invite/${token}`;

  // ── Optional: send email via Supabase Admin (requires SUPABASE_SERVICE_ROLE_KEY) ──
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let emailSent = false;
  if (serviceRoleKey) {
    try {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
      );
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/invite/${token}/accept`,
      });
      emailSent = true;
    } catch {
      // Non-fatal — link still works
    }
  }

  return NextResponse.json({ ok: true, inviteUrl, emailSent });
}
