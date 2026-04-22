/**
 * lib/team-role.ts
 *
 * Role enforcement for workspace team members.
 *
 * Roles:
 *   "editor"  — full access (create/edit campaigns, rules, etc.)
 *   "viewer"  — read-only (can see data, cannot mutate)
 *
 * Usage in any mutation API route:
 *   const check = await assertCanMutate(userId);
 *   if (check) return check; // returns a 403 NextResponse if viewer
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RoleRow {
  role: string;
}

/**
 * Returns the role of a user in their workspace, or null if they are an owner
 * (owners are always allowed to mutate).
 */
export async function getMemberRole(userId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<RoleRow[]>`
      SELECT role FROM "TeamMember" WHERE "memberId" = ${userId} LIMIT 1
    `;
    if (rows.length > 0) return rows[0].role;
  } catch {
    // Table may not exist in dev yet
  }
  return null; // not a member → they are an owner → full access
}

/**
 * Returns a 403 NextResponse if the user is a "viewer" member, null otherwise.
 * Call at the top of every mutation route that members can reach.
 *
 * @example
 * const block = await assertCanMutate(user.id);
 * if (block) return block;
 */
export async function assertCanMutate(userId: string): Promise<NextResponse | null> {
  const role = await getMemberRole(userId);
  if (role === "viewer") {
    return NextResponse.json(
      { error: "Read-only access — viewer role cannot modify data" },
      { status: 403 },
    );
  }
  return null;
}
