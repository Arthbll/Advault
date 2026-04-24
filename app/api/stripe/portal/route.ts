import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/stripe/portal
 *
 * Crée une session Stripe Customer Portal pour gérer l'abonnement
 * (changer de plan, annuler, voir les factures).
 * Crée automatiquement une configuration portal si aucune n'existe.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerId = (dbUser as any)?.stripeCustomerId as string | undefined;

    if (!customerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://advault-project.vercel.app";

    // Récupérer ou créer la configuration du portail
    let configurationId: string | undefined;
    try {
      const configs = await stripe.billingPortal.configurations.list({ limit: 1 });
      if (configs.data.length > 0) {
        configurationId = configs.data[0].id;
      }
    } catch { /* ignore */ }

    if (!configurationId) {
      const config = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: "Manage your ProfitDash subscription",
        },
        features: {
          subscription_cancel: { enabled: true },
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            proration_behavior: "create_prorations",
            products: [
              {
                product: (await stripe.prices.retrieve(
                  process.env.STRIPE_PRICE_OPERATOR_MONTHLY?.trim() ?? ""
                )).product as string,
                prices: [
                  process.env.STRIPE_PRICE_OPERATOR_MONTHLY?.trim() ?? "",
                  process.env.STRIPE_PRICE_OPERATOR_ANNUAL?.trim()  ?? "",
                ],
              },
            ],
          },
          invoice_history: { enabled: true },
        },
      });
      configurationId = config.id;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:      customerId,
      return_url:    `${siteUrl}/dashboard/settings?tab=plan`,
      configuration: configurationId,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/portal]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
