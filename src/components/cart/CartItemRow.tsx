"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import type { CartItem } from "@/lib/types";

export default function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <div className="flex gap-4 border-b border-stone-light py-5 last:border-0">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-cream-dark">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/product/${item.slug}`} className="font-medium text-ink hover:text-gold-dark">
              {item.name}
            </Link>
            <p className="text-xs text-stone">
              {item.brand} · {item.size}
            </p>
          </div>
          <button
            onClick={() => removeItem(item.productId)}
            aria-label="Remove item"
            className="text-stone hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center rounded-full border border-stone-light">
            <button
              className="flex h-9 w-9 items-center justify-center text-stone hover:text-ink"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              className="flex h-9 w-9 items-center justify-center text-stone hover:text-ink"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
              aria-label="Increase quantity"
              disabled={item.quantity >= item.maxQuantity}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="font-semibold text-ink">{formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
    </div>
  );
}
