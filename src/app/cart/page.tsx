"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import CartItemRow from "@/components/cart/CartItemRow";
import CheckoutButton from "@/components/cart/CheckoutButton";

export default function CartPage() {
  const { items, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="page-container flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">Your cart is empty</h1>
        <p className="text-stone">Browse the shop to find your next signature scent.</p>
        <Link href="/shop" className="btn-primary">
          Shop Fragrances
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink">Your Cart</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {items.map((item) => (
            <CartItemRow key={item.productId} item={item} />
          ))}
        </div>

        <div className="card h-fit p-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Order Summary</h2>
          <div className="mt-4 flex justify-between text-sm text-stone">
            <span>Subtotal</span>
            <span className="font-medium text-ink">{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-stone">Shipping and taxes calculated at checkout.</p>
          <div className="mt-6">
            <CheckoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
