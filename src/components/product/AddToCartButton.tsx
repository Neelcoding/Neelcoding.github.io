"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const soldOut = product.is_sold_out || product.quantity <= 0;

  if (soldOut) {
    return (
      <button disabled className="btn-primary w-full opacity-50">
        Sold Out
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex items-center rounded-full border border-stone-light">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center text-stone hover:text-ink"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center text-sm font-medium">{quantity}</span>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center text-stone hover:text-ink"
          onClick={() => setQuantity((q) => Math.min(product.quantity, q + 1))}
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        className="btn-primary flex-1"
        onClick={() => {
          addItem({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            price: product.price,
            image: product.product_images?.[0]?.url ?? null,
            size: product.size,
            quantity,
            maxQuantity: product.quantity,
          });
          setAdded(true);
          setTimeout(() => setAdded(false), 2000);
        }}
      >
        {added ? "Added to Cart" : "Add to Cart"}
      </button>
    </div>
  );
}
