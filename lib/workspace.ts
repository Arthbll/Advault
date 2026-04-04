/**
 * lib/workspace.ts
 *
 * Workspace resolution for team members.
 *
 * When a user is an invited member of another user's Command-plan workspace,
 * all data queries should target the OWNER's userId, not their own.
 *
 * Usage in any API route:
 *   const workspaceUserId = await resolveWorkspaceUserId(user.id);
 *   // Use workspaceUserId instead of user.id for all data queries
 */

import { prisma } from "@/lib/prisma";

interface TeamMemberRow {
  ownerId: string;
}

/**
 * Returns the userId whose workspace data should be used for a given auth user.
 * - If the user is a team member → returns the owner's userId
 * - Otherwise → returns the user's own userId
 */
export async function resolveWorkspaceUserId(userId: string): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<TeamMemberRow[]>`
      SELECT "ownerId" FROM "TeamMember"
      WHERE "memberId" = ${userId}
      LIMIT 1
    `;
    if (rows.length > 0) return rows[0].ownerId;
  } catch {
    // Table may not exist in dev yet — fall through to own userId
  }
  return userId;
}

/**
 * Returns true if the given userId is an owner of a Command workspace
 * (i.e. has at least one team member).
 */
export async function isWorkspaceOwner(userId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "TeamMember" WHERE "ownerId" = ${userId} LIMIT 1
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
