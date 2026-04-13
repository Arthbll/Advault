/**
 * POST /api/waitlist  — enregistre un email en liste d'attente
 * GET  /api/waitlist  — lecture réservée à l'admin (WAITLIST_ADMIN_SECRET requis)
 *
 * Stockage : table "waitlist" Supabase via service role.
 * À créer dans le dashboard Supabase :
 *   CREATE TABLE waitlist (email TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
 *
 * ⚠️ L'ancienne version utilisait fs.writeFile — crash garanti sur Vercel
 *    car le filesystem y est en lecture seule. Remplacé par Supabase REST.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const admin = getAdminClient();

    if (admin) {
      const { error } = await admin
        .from("waitlist")
        .upsert({ email: normalized, created_at: new Date().toISOString() }, { onConflict: "email" });

      if (error) {
        // Table inexistante ou autre erreur → log, ne pas bloquer l'utilisateur
        console.error("[waitlist] Supabase error:", error.message);
      }
    } else {
      // Dev local sans service role key
      console.log("[waitlist] New signup (no DB configured):", normalized);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Lecture protégée par secret admin — jamais accessible publiquement
  const secret = process.env.WAITLIST_ADMIN_SECRET;
  const auth   = req.headers.get("authorization") ?? "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "Service not configured" }, { status: 501 });

  const { data, error } = await admin
    .from("waitlist")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: data?.length ?? 0, entries: data ?? [] });
}
