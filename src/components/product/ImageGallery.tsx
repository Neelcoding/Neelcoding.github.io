"use client";

import Image from "next/image";
import { useState } from "react";
import { clsx } from "clsx";
import type { ProductImage } from "@/lib/types";

export default function ImageGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-cream-dark">
        {active ? (
          <Image
            src={active.url}
            alt={productName}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone">
            No image available
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-5 gap-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setActiveIndex(index)}
              className={clsx(
                "relative aspect-square overflow-hidden rounded-lg border-2 bg-cream-dark",
                index === activeIndex ? "border-gold" : "border-transparent"
              )}
            >
              <Image src={image.url} alt="" fill sizes="20vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
