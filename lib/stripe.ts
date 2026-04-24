import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil",
});

// Price IDs — test mode
export const STRIPE_PRICES = {
  operator: {
    monthly: process.env.STRIPE_PRICE_OPERATOR_MONTHLY!,
    annual:  process.env.STRIPE_PRICE_OPERATOR_ANNUAL!,
  },
  dominion: {
    monthly: process.env.STRIPE_PRICE_DOMINION_MONTHLY!,
    annual:  process.env.STRIPE_PRICE_DOMINION_ANNUAL!,
  },
} as const;

// Mapping price ID → plan name
export function planIdFromPriceId(priceId: string): string {
  const { operator, dominion } = STRIPE_PRICES;
  if ([operator.monthly, operator.annual].includes(priceId)) return "operator";
  if ([dominion.monthly, dominion.annual].includes(priceId)) return "dominion";
  return "observer";
}
