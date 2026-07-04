import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe calls this URL after a checkout session finishes. It's the only
 * reliable way to know a payment actually succeeded (the success page the
 * customer sees can be closed, refreshed, or skipped entirely).
 *
 * Setup: create a webhook endpoint in the Stripe dashboard pointing at
 * https://yourdomain.com/api/webhooks/stripe, listening for
 * "checkout.session.completed", and put its signing secret in
 * STRIPE_WEBHOOK_SECRET. See README.md for the full walkthrough (including
 * the Stripe CLI command for local testing).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  // Already processed (Stripe can send the same event more than once) —
  // skip so we don't double-decrement stock.
  if (!order || order.status === "paid") return;

  await supabase
    .from("orders")
    .update({
      status: "paid",
      customer_email: session.customer_details?.email ?? null,
      customer_name: session.customer_details?.name ?? null,
      shipping_address: session.shipping_details ?? session.customer_details?.address ?? null,
    })
    .eq("id", orderId);

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);

  for (const item of orderItems ?? []) {
    if (!item.product_id) continue;

    const { data: product } = await supabase
      .from("products")
      .select("quantity")
      .eq("id", item.product_id)
      .maybeSingle();

    if (!product) continue;

    const newQuantity = Math.max(0, product.quantity - item.quantity);
    await supabase
      .from("products")
      .update({ quantity: newQuantity, is_sold_out: newQuantity <= 0 })
      .eq("id", item.product_id);
  }
}
