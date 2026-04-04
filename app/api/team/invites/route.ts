/**
 * GET /api/team/invites
 * Returns all pending invites sent by the authenticated owner.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface InviteRow {
  id: string;
  email: string;
  token: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invites = await prisma.$queryRaw<InviteRow[]>`
    SELECT id, email, token, role, status, "expiresAt", "createdAt"
    FROM "TeamInvite"
    WHERE "ownerId" = ${user.id} AND status = 'pending'
    ORDER BY "createdAt" DESC
  `;

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return NextResponse.json(invites.map(i => ({
    ...i,
    inviteUrl: `${origin}/invite/${i.token}`,
  })));
}
