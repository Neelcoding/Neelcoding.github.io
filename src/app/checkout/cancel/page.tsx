import Link from "next/link";
import { XCircle } from "lucide-react";

export default function CheckoutCancelPage() {
  return (
    <div className="page-container flex flex-col items-center gap-4 py-24 text-center">
      <XCircle className="h-12 w-12 text-stone" />
      <h1 className="font-serif text-2xl font-semibold text-ink">Checkout canceled</h1>
      <p className="max-w-md text-stone">
        No charge was made. Your cart is still saved if you&rsquo;d like to try again.
      </p>
      <Link href="/cart" className="btn-primary">
        Back to Cart
      </Link>
    </div>
  );
}
