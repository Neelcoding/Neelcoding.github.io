import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import ImageGallery from "@/components/product/ImageGallery";
import AddToCartButton from "@/components/product/AddToCartButton";
import Badge from "@/components/ui/Badge";
import type { Product } from "@/lib/types";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

const DETAIL_FIELDS: { key: keyof Product; label: string }[] = [
  { key: "size", label: "Size" },
  { key: "concentration", label: "Concentration" },
  { key: "condition", label: "Condition" },
  { key: "longevity", label: "Longevity" },
  { key: "projection", label: "Projection" },
  { key: "season", label: "Season" },
  { key: "occasion", label: "Occasion" },
];

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const soldOut = product.is_sold_out || product.quantity <= 0;

  return (
    <div className="page-container py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <ImageGallery images={product.product_images ?? []} productName={product.name} />

        <div>
          <p className="text-sm uppercase tracking-wide text-stone">{product.brand}</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-ink">{product.name}</h1>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-2xl font-semibold text-ink">{formatPrice(product.price)}</span>
            {soldOut ? (
              <Badge tone="red">Sold Out</Badge>
            ) : (
              <Badge tone="green">{product.quantity} available</Badge>
            )}
          </div>

          {product.short_description && (
            <p className="mt-4 text-stone">{product.short_description}</p>
          )}

          <div className="mt-6">
            <AddToCartButton product={product} />
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-stone-light pt-6 sm:grid-cols-3">
            {DETAIL_FIELDS.map(({ key, label }) => {
              const value = product[key];
              if (!value) return null;
              return (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-wide text-stone">{label}</dt>
                  <dd className="mt-1 text-sm capitalize text-ink">{String(value)}</dd>
                </div>
              );
            })}
          </dl>

          {product.description && (
            <div className="mt-8 border-t border-stone-light pt-6">
              <h2 className="font-serif text-lg font-semibold text-ink">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-stone">{product.description}</p>
            </div>
          )}

          <div className="mt-8 grid gap-4 border-t border-stone-light pt-6 sm:grid-cols-3">
            <NotesBlock label="Top Notes" notes={product.top_notes} />
            <NotesBlock label="Middle Notes" notes={product.middle_notes} />
            <NotesBlock label="Base Notes" notes={product.base_notes} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesBlock({ label, notes }: { label: string; notes: string | null }) {
  if (!notes) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-dark">{label}</h3>
      <p className="mt-1 text-sm text-stone">{notes}</p>
    </div>
  );
}
