import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1, "Cart is empty"),
});

/**
 * Creates a Stripe Checkout session for the items in the visitor's cart.
 *
 * Prices are always re-read from the database here — never trusted from the
 * client — so someone editing the browser cart can't pay less than the
 * real price. An "orders" row (status: pending) is created up front so the
 * webhook only has to flip its status to "paid" once Stripe confirms
 * payment (see src/app/api/webhooks/stripe/route.ts).
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const supabase = createAdminClient();
  const productIds = parsed.data.items.map((item) => item.productId);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, quantity, is_active, is_sold_out, product_images(url, position)")
    .in("id", productIds);

  if (error || !products) {
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }

  const lineItems: {
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    image?: string;
  }[] = [];

  for (const item of parsed.data.items) {
    const product = products.find((p) => p.id === item.productId);

    if (!product || !product.is_active || product.is_sold_out) {
      return NextResponse.json(
        { error: `A product in your cart is no longer available.` },
        { status: 409 }
      );
    }
    if (product.quantity < item.quantity) {
      return NextResponse.json(
        { error: `Only ${product.quantity} left of "${product.name}".` },
        { status: 409 }
      );
    }

    const sortedImages = [...(product.product_images ?? [])].sort(
      (a, b) => a.position - b.position
    );

    lineItems.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
      image: sortedImages[0]?.url,
    });
  }

  const amountTotal = lineItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ amount_total: amountTotal, currency: "usd", status: "pending" })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    lineItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      unit_price: item.unitPrice,
      quantity: item.quantity,
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: "Could not create order items." }, { status: 500 });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? request.headers.get("origin") ?? "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.unitPrice * 100),
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : undefined,
        },
      },
    })),
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    metadata: { order_id: order.id },
  });

  await supabase.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);

  return NextResponse.json({ url: session.url });
}
