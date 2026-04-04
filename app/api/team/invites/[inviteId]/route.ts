/**
 * DELETE /api/team/invites/[inviteId]
 * Revokes a pending invite.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await params;

  await prisma.$executeRaw`
    UPDATE "TeamInvite" SET status = 'revoked'
    WHERE id = ${inviteId} AND "ownerId" = ${user.id}
  `;

  return NextResponse.json({ ok: true });
}
