import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyTrustedDevice, TRUSTED_DEVICE_COOKIE } from "@/lib/trusted-device";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do NOT remove this await
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute    = pathname.startsWith("/login") || pathname.startsWith("/register")
                       || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password");
  const isMFAChallenge = pathname.startsWith("/mfa-challenge");
  // Public routes — accessible without authentication
  const isPublicRoute  = pathname === "/" || pathname.startsWith("/api/waitlist");

  // Redirect unauthenticated users away from protected routes
  if (!user && !isAuthRoute && !isMFAChallenge && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Enforce MFA aal2 for dashboard routes
  if (user && pathname.startsWith("/dashboard")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      // Check trusted-device cookie before forcing MFA challenge
      const tdToken = request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value;
      const trusted = tdToken ? await verifyTrustedDevice(tdToken, user.id) : false;
      if (!trusted) {
        const url = request.nextUrl.clone();
        url.pathname = "/mfa-challenge";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
