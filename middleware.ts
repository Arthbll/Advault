import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // On exclut les fichiers statiques, les images, et toutes les routes API
    // publiques (cron, postback, demo) qui ont leur propre auth interne.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/cron|api/postback|api/demo|api/waitlist).*)",
  ],
};
