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
  const isPublicRoute  = pathname === "/"
                       || pathname.startsWith("/api/waitlist")
                       || pathname.startsWith("/privacy")
                       || pathname.startsWith("/terms")
                       || pathname.startsWith("/auth/callback");

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

  // ── First-time welcome redirect ──────────────────────────────────────────
  // If the user hasn't seen the welcome page yet, redirect them there
  // on any /dashboard hit. Works for all auth methods (OAuth, magic link,
  // email+password) — not just the /auth/callback code flow.
  if (user && pathname.startsWith("/dashboard")) {
    const welcomed = user.user_metadata?.welcomed;
    if (!welcomed) {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      return NextResponse.redirect(url);
    }
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

  // ── Session nonce enforcement — max 3 concurrent devices ──────────────────
  // Only active on /dashboard/* and when session_nonces are present in user_metadata
  // (which requires SUPABASE_SERVICE_ROLE_KEY to have been set at login time).
  if (user && pathname.startsWith("/dashboard")) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const validNonces: string[] = Array.isArray(meta?.session_nonces)
      ? (meta.session_nonces as string[])
      : [];

    if (validNonces.length > 0) {
      const cookieNonce = request.cookies.get("_snonce")?.value;

      // Device has no nonce cookie (logged in before this feature) → let through
      if (cookieNonce && !validNonces.includes(cookieNonce)) {
        // This device was evicted (a 4th device pushed it out) → force sign-out
        await supabase.auth.signOut();

        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("reason", "kicked");

        const kickResponse = NextResponse.redirect(loginUrl);
        kickResponse.cookies.set("_snonce", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
        return kickResponse;
      }
    }
  }

  return supabaseResponse;
}
