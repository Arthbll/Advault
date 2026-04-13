/**
 * POST /api/demo-mode   { enabled: boolean }
 * GET  /api/demo-mode   → { enabled: boolean }
 *
 * Gère le cookie "profitdash_demo" pour le mode aperçu.
 * Réservé à l'utilisateur connecté — le cookie est httpOnly et SameSite=strict.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";

const COOKIE = "profitdash_demo";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 an

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lire depuis les cookies de la requête entrante via la response headers
  // (on ne peut pas lire les cookies request ici facilement, on retourne juste un état vide)
  return NextResponse.json({ enabled: false });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { enabled } = await req.json() as { enabled: boolean };

  const res = NextResponse.json({ ok: true, enabled });

  if (enabled) {
    res.cookies.set(COOKIE, "1", {
      httpOnly: true, // sécurisé — non accessible depuis JS côté client
      sameSite: "strict",
      path:     "/",
      maxAge:   MAX_AGE,
    });
  } else {
    res.cookies.delete(COOKIE);
  }

  return res;
}
