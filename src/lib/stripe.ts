import "server-only";
import Stripe from "stripe";

// Server-only Stripe client. STRIPE_SECRET_KEY must never be exposed to the
// browser — this file is safe because of the "server-only" import, which
// makes any accidental client-side import fail at build time.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});
