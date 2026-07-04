import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";

export default function ProductCard({ product }: { product: Product }) {
  const image = product.product_images?.[0]?.url;
  const soldOut = product.is_sold_out || product.quantity <= 0;

  return (
    <Link href={`/product/${product.slug}`} className="card group flex flex-col overflow-hidden">
      <div className="relative aspect-square w-full overflow-hidden bg-cream-dark">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone">
            No image
          </div>
        )}
        {soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream">
            Sold Out
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs uppercase tracking-wide text-stone">{product.brand}</p>
        <h3 className="font-serif text-base font-semibold text-ink group-hover:text-gold-dark">
          {product.name}
        </h3>
        <p className="text-xs text-stone">
          {product.size} · {product.concentration}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-semibold text-ink">{formatPrice(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}
