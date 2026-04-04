/**
 * DELETE /api/team/members/[memberId]
 * Removes a member from the owner's workspace.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId } = await params;

  await prisma.$executeRaw`
    DELETE FROM "TeamMember"
    WHERE id = ${memberId} AND "ownerId" = ${user.id}
  `;

  return NextResponse.json({ ok: true });
}
