import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

interface InviteRow { id: string; ownerId: string; role: string; }
interface LastIpRow  { lastLoginIp: string | null; }

function getIp(req: Request): string {
  const h = req.headers as unknown as { get(k: string): string | null };
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

function getUa(req: Request): string {
  const h = req.headers as unknown as { get(k: string): string | null };
  return h.get("user-agent") ?? "unknown";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      const ip = getIp(request);
      const ua = getUa(request);

      // Ensure User shadow row exists
      try {
        await prisma.$executeRaw`
          INSERT INTO "User" (id, email) VALUES (${user.id}, ${user.email ?? ""})
          ON CONFLICT (id) DO NOTHING
        `;
      } catch { /* non-fatal */ }

      // ── Session nonces — max 3 concurrent devices ──────────────────────────
      // Each login generates a new nonce added to a rolling list (max 3).
      // The oldest nonce is dropped when a 4th device connects, kicking it out.
      // The middleware validates that the device's _snonce cookie is in the list.
      const MAX_SESSIONS = 3;
      const sessionNonce = crypto.randomUUID();
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        try {
          const { createClient: adminCreate } = await import("@supabase/supabase-js");
          const admin = adminCreate(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

          // Read existing nonces, prepend the new one, cap to MAX_SESSIONS
          const existingNonces: string[] =
            Array.isArray(user.user_metadata?.session_nonces)
              ? (user.user_metadata.session_nonces as string[])
              : [];
          const updatedNonces = [sessionNonce, ...existingNonces].slice(0, MAX_SESSIONS);

          await admin.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...(user.user_metadata ?? {}),
              session_nonces: updatedNonces,
            },
          });
        } catch { /* non-fatal — nonce enforcement requires SERVICE_ROLE_KEY */ }
      }

      // ── Login event logging + new-IP detection ─────────────────────────────
      try {
        // Get last known login IP from UserSettings
        const ipRows = await prisma.$queryRaw<LastIpRow[]>`
          SELECT "lastLoginIp" FROM "UserSettings" WHERE "userId" = ${user.id} LIMIT 1
        `.catch(() => [] as LastIpRow[]);

        const lastIp = ipRows[0]?.lastLoginIp ?? null;
        const isNewIp = lastIp !== null && lastIp !== ip && ip !== "unknown";

        // Log the sign-in event
        await prisma.$executeRaw`
          INSERT INTO "Log" (id, "userId", type, message, metadata)
          VALUES (
            gen_random_uuid(), ${user.id}, 'SECURITY_EVENT',
            ${isNewIp ? `Sign-in from new IP — ${ip}` : `Sign-in — ${ip}`},
            ${JSON.stringify({
              event: isNewIp ? "new_ip_login" : "sign_in",
              ip,
              previousIp: isNewIp ? lastIp : null,
              ua: ua.slice(0, 200),
            })}::jsonb
          )
        `;

        // Update lastLoginIp in UserSettings (upsert)
        await prisma.$executeRaw`
          INSERT INTO "UserSettings" (id, "userId", "lastLoginIp")
          VALUES (gen_random_uuid(), ${user.id}, ${ip})
          ON CONFLICT ("userId") DO UPDATE SET "lastLoginIp" = ${ip}, "updatedAt" = now()
        `;
      } catch { /* non-fatal — DB might not have lastLoginIp column yet */ }

      // ── Auto-accept any pending team invite that matches this email ─────────
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

      // ── First-time welcome redirect ────────────────────────────────────────
      // If the user hasn't seen the welcome page yet, send them there instead.
      const isNewUser = !user.user_metadata?.welcomed;
      const finalNext = isNewUser && next === "/dashboard" ? "/welcome" : next;

      const redirectRes = NextResponse.redirect(`${origin}${finalNext}`);

      // Set the nonce cookie — httpOnly so JS can't read it
      if (serviceRoleKey) {
        redirectRes.cookies.set("_snonce", sessionNonce, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }

      return redirectRes;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
