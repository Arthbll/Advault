import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes API qui ont leur propre système d'auth (CRON_SECRET, token postback…).
// Elles ne doivent JAMAIS passer par le guard Supabase — retour immédiat sans vérification.
const PUBLIC_API_PREFIXES = [
  "/api/cron/",
  "/api/track",
  "/api/postback",
  "/api/demo",
  "/api/waitlist",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Exclut uniquement les assets statiques — la logique métier est gérée
    // directement dans la fonction middleware ci-dessus.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
