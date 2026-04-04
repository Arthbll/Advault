/**
 * GET /api/team/members
 * Returns all active team members for the authenticated owner.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface MemberRow {
  id: string;
  memberId: string;
  email: string;
  role: string;
  createdAt: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.$queryRaw<MemberRow[]>`
    SELECT tm.id, tm."memberId", u.email, tm.role, tm."createdAt"
    FROM "TeamMember" tm
    JOIN "User" u ON u.id = tm."memberId"
    WHERE tm."ownerId" = ${user.id}
    ORDER BY tm."createdAt" ASC
  `;

  return NextResponse.json(members);
}
