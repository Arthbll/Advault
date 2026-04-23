import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * /auth/callback
 *
 * Supabase redirige l'utilisateur ici après:
 *   - une connexion Google OAuth
 *   - un clic sur un magic link
 *   - un clic sur un lien de confirmation d'email
 *   - un clic sur un lien de reset de mot de passe
 *
 * Cette route échange le "code" reçu contre une vraie session Supabase,
 * puis redirige l'utilisateur vers la bonne page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Something went wrong — redirect to login with an error hint
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("reason", "auth_error");
  return NextResponse.redirect(loginUrl);
}
