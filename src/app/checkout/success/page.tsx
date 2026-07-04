"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();

  // The Stripe payment succeeded to get here, so it's safe to empty the cart.
  useEffect(() => {
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-container flex flex-col items-center gap-4 py-24 text-center">
      <CheckCircle2 className="h-12 w-12 text-gold-dark" />
      <h1 className="font-serif text-2xl font-semibold text-ink">Thank you for your order!</h1>
      <p className="max-w-md text-stone">
        Your payment was successful. You&rsquo;ll receive a confirmation email shortly, and
        your fragrance will be on its way soon.
      </p>
      <Link href="/shop" className="btn-primary">
        Continue Shopping
      </Link>
    </div>
  );
}
