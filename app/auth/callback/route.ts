import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface InviteRow { id: string; ownerId: string; role: string; }

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Ensure User shadow row exists
      try {
        await prisma.$executeRaw`
          INSERT INTO "User" (id, email) VALUES (${user.id}, ${user.email ?? ""})
          ON CONFLICT (id) DO NOTHING
        `;
      } catch { /* non-fatal */ }

      // Auto-accept any pending team invite that matches this email
      try {
        const email = (user.email ?? "").toLowerCase();
        const invites = await prisma.$queryRaw<InviteRow[]>`
          SELECT id, "ownerId", role FROM "TeamInvite"
          WHERE email = ${email} AND status = 'pending' AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1
        `;
        if (invites.length > 0) {
          const invite = invites[0];
          await prisma.$executeRaw`
            INSERT INTO "TeamMember" (id, "ownerId", "memberId", role)
            VALUES (gen_random_uuid(), ${invite.ownerId}, ${user.id}, ${invite.role})
            ON CONFLICT ("memberId") DO UPDATE SET "ownerId" = ${invite.ownerId}, role = ${invite.role}
          `;
          await prisma.$executeRaw`
            UPDATE "TeamInvite" SET status = 'accepted' WHERE id = ${invite.id}
          `;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (serviceRoleKey) {
            const { createClient: adminCreate } = await import("@supabase/supabase-js");
            const admin = adminCreate(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
            await admin.auth.admin.updateUserById(user.id, {
              user_metadata: { ...(user.user_metadata ?? {}), role: "member", plan: "Command" },
            }).catch(() => {});
          }
        }
      } catch { /* non-fatal */ }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
