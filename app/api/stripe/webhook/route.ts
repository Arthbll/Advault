import { NextResponse } from "next/server";
import { stripe, planIdFromPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 *
 * Reçoit les événements Stripe et met à jour le plan de l'utilisateur.
 * Met à jour à la fois la DB Prisma ET les métadonnées Supabase Auth
 * (les deux sont lus par l'UI selon l'endroit).
 *
 * Events gérés :
 *   - checkout.session.completed      → abonnement activé
 *   - customer.subscription.updated   → changement de plan ou renouvellement
 *   - customer.subscription.deleted   → annulation → retour observer
 *   - invoice.payment_failed          → marquer past_due
 */

function adminSupabase() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Met à jour les métadonnées Supabase Auth d'un user (plan affiché dans l'UI) */
async function updateSupabasePlan(userId: string, plan: string) {
  const supabase = adminSupabase();
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { plan },
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig  = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId     = session.metadata?.userId;
        const subId      = session.subscription as string;
        const customerId = session.customer as string;

        if (!userId) break;

        const sub       = await stripe.subscriptions.retrieve(subId);
        const priceId   = sub.items.data[0]?.price.id ?? "";
        const planId    = planIdFromPriceId(priceId);
        const periodEnd = new Date(sub.current_period_end * 1000);

        // Mise à jour DB
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.user as any).update({
          where: { id: userId },
          data: {
            stripeCustomerId:         customerId,
            stripeSubscriptionId:     subId,
            stripePriceId:            priceId,
            stripeSubscriptionStatus: sub.status,
            planId,
            planCurrentPeriodEnd:     periodEnd,
          },
        });

        // Mise à jour métadonnées Supabase Auth (plan affiché dans l'UI)
        await updateSupabasePlan(userId, planId);
        break;
      }

      case "customer.subscription.updated": {
        const sub       = event.data.object as Stripe.Subscription;
        const priceId   = sub.items.data[0]?.price.id ?? "";
        const planId    = planIdFromPriceId(priceId);
        const periodEnd = new Date(sub.current_period_end * 1000);

        // Retrouver l'user via stripeSubscriptionId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbUser = await (prisma.user as any).findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.user as any).updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripePriceId:            priceId,
            stripeSubscriptionStatus: sub.status,
            planId,
            planCurrentPeriodEnd:     periodEnd,
          },
        });

        if (dbUser?.id) await updateSupabasePlan(dbUser.id, planId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbUser = await (prisma.user as any).findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { id: true },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.user as any).updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            stripeSubscriptionStatus: "canceled",
            planId:                   "observer",
            planCurrentPeriodEnd:     null,
          },
        });

        if (dbUser?.id) await updateSupabasePlan(dbUser.id, "observer");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId   = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;

        if (subId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (prisma.user as any).updateMany({
            where: { stripeSubscriptionId: subId },
            data: { stripeSubscriptionStatus: "past_due" },
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] Error processing event:", event.type, err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
