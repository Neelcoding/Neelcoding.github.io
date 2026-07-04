"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatPrice } from "@/lib/format";
import {
  deleteProduct,
  toggleProductActive,
  toggleProductSoldOut,
} from "@/lib/actions/products";
import type { Product } from "@/lib/types";

export default function ProductTable({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    startTransition(() => deleteProduct(product.id));
  }

  if (products.length === 0) {
    return (
      <p className="card p-8 text-center text-stone">
        No fragrances yet.{" "}
        <Link href="/admin/products/new" className="text-gold-dark hover:underline">
          Add your first one.
        </Link>
      </p>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-cream-dark/60 text-xs uppercase tracking-wide text-stone">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Brand</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const soldOut = product.is_sold_out || product.quantity <= 0;
            return (
              <tr key={product.id} className="border-t border-stone-light">
                <td className="px-4 py-3 font-medium text-ink">{product.name}</td>
                <td className="px-4 py-3 text-stone">{product.brand}</td>
                <td className="px-4 py-3 text-stone">{formatPrice(product.price)}</td>
                <td className="px-4 py-3 text-stone">{product.quantity}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={product.is_active ? "green" : "gray"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {soldOut && <Badge tone="red">Sold Out</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() =>
                          toggleProductActive(product.id, !product.is_active)
                        )
                      }
                      className="text-xs font-medium text-stone hover:text-ink"
                    >
                      {product.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        startTransition(() =>
                          toggleProductSoldOut(product.id, !product.is_sold_out)
                        )
                      }
                      className="text-xs font-medium text-stone hover:text-ink"
                    >
                      {product.is_sold_out ? "Mark In Stock" : "Mark Sold Out"}
                    </button>
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      aria-label="Edit"
                      className="text-stone hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      disabled={isPending}
                      onClick={() => handleDelete(product)}
                      aria-label="Delete"
                      className="text-stone hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
