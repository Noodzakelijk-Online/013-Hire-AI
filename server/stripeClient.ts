import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!apiKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY before using billing features.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey);
  }
  return stripeClient;
}
