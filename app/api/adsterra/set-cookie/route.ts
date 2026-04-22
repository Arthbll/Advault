/**
 * POST /api/adsterra/set-cookie
 * Body: { cookie: string }
 *
 * Chiffre le cookie de session rst4-uid et le sauvegarde dans
 * account.apiSecretEnc pour le compte Adsterra de l'utilisateur.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }           from "@/lib/supabase/server";
import { prisma }                 from "@/lib/prisma";
import { encrypt }                from "@/lib/crypto";
import { Network }                from "@prisma/client";
import { resolveWorkspaceUserId } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);

  let body: { cookie?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const { cookie } = body;
  if (!cookie?.trim()) {
    return NextResponse.json({ error: "cookie requis" }, { status: 400 });
  }

  const account = await prisma.account.findFirst({
    where: { userId, network: Network.ADSTERRA },
  });

  if (!account) {
    return NextResponse.json({ error: "Aucun compte Adsterra trouvé" }, { status: 404 });
  }

  await prisma.account.update({
    where: { id: account.id },
    data:  { apiSecretEnc: encrypt(cookie.trim()) },
  });

  return NextResponse.json({ ok: true, accountId: account.id });
}
