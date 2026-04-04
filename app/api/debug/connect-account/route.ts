/**
 * GET /api/debug/connect-account
 *
 * One-time setup route: reads EXOCLICK_API_KEY from .env.local and
 * saves it encrypted in the database for the currently logged-in user.
 *
 * Visit this URL once while logged in to connect your ExoClick account
 * without going through the Settings UI.
 */
import { NextResponse }         from "next/server";
import { createClient }         from "@/lib/supabase/server";
import { prisma }               from "@/lib/prisma";
import { encrypt }              from "@/lib/crypto";
import { Network }              from "@prisma/client";

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Non authentifié — connecte-toi d'abord." }, { status: 401 });
  }

  const apiKey = process.env.EXOCLICK_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "EXOCLICK_API_KEY introuvable dans .env.local" },
      { status: 500 }
    );
  }

  // Ensure User row exists (mirrors Supabase auth.users)
  await prisma.user.upsert({
    where:  { id: user.id },
    update: { email: user.email! },
    create: { id: user.id, email: user.email! },
  });

  const apiKeyEnc = encrypt(apiKey.trim());

  await prisma.account.upsert({
    where:  { userId_network: { userId: user.id, network: Network.EXOCLICK } },
    create: { userId: user.id, network: Network.EXOCLICK, apiKeyEnc, isActive: true },
    update: { apiKeyEnc, isActive: true, updatedAt: new Date() },
  });

  return NextResponse.json({
    ok:      true,
    message: "Compte ExoClick connecté avec succès depuis .env.local",
    user:    user.email,
    keyPreview: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`,
  });
}
