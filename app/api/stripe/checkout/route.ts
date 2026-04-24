import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 * Body: { priceId: string }
 *
 * Crée une Stripe Checkout Session pour l'abonnement demandé.
 * Redirige vers Stripe Checkout.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await request.json();

    // Valider que le priceId est l'un des nôtres
    const validPrices = [
      STRIPE_PRICES.operator.monthly,
      STRIPE_PRICES.operator.annual,
      STRIPE_PRICES.dominion.monthly,
      STRIPE_PRICES.dominion.annual,
    ];
    if (!validPrices.includes(priceId)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://advault-project.vercel.app";

    // Si l'utilisateur a déjà un customer Stripe, le réutiliser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customerId = (dbUser as any).stripeCustomerId as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.user as any).update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${siteUrl}/upgrade-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard/settings?tab=billing`,
      allow_promotion_codes: true,
      metadata: { userId: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
