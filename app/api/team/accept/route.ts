/**
 * POST /api/team/accept
 * Body: { token: string }
 *
 * Accepts a team invite for the currently authenticated user.
 * - Validates token exists, is pending, not expired
 * - Creates TeamMember row
 * - Marks invite as accepted
 * - Updates the user's Supabase metadata with role="member" and plan="Command"
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

interface InviteRow {
  id: string;
  ownerId: string;
  email: string;
  role: string;
  expiresAt: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  // Find invite
  const invites = await prisma.$queryRaw<InviteRow[]>`
    SELECT id, "ownerId", email, role, "expiresAt"
    FROM "TeamInvite"
    WHERE token = ${token} AND status = 'pending'
    LIMIT 1
  `;

  if (invites.length === 0) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
  }

  const invite = invites[0];

  // Check expiry
  if (new Date(invite.expiresAt) < new Date()) {
    await prisma.$executeRaw`UPDATE "TeamInvite" SET status = 'revoked' WHERE id = ${invite.id}`;
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // Make sure the User row exists (shadow table) — upsert
  await prisma.$executeRaw`
    INSERT INTO "User" (id, email) VALUES (${user.id}, ${user.email ?? ""})
    ON CONFLICT (id) DO NOTHING
  `;

  // Create TeamMember (idempotent — if already a member of this workspace, no-op)
  await prisma.$executeRaw`
    INSERT INTO "TeamMember" (id, "ownerId", "memberId", role)
    VALUES (gen_random_uuid(), ${invite.ownerId}, ${user.id}, ${invite.role})
    ON CONFLICT ("memberId") DO UPDATE SET "ownerId" = ${invite.ownerId}, role = ${invite.role}
  `;

  // Mark invite accepted
  await prisma.$executeRaw`
    UPDATE "TeamInvite" SET status = 'accepted' WHERE id = ${invite.id}
  `;

  // Update user_metadata: role = "member", plan = "Command"
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    try {
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
      );
      await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata ?? {}),
          role: "member",
          plan: "Command",
        },
      });
    } catch {
      // Non-fatal — membership row already created
    }
  }

  return NextResponse.json({ ok: true, ownerId: invite.ownerId });
}
