import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFeaturedProducts } from "@/lib/products";
import ProductCard from "@/components/shop/ProductCard";

export default async function HomePage() {
  const featured = await getFeaturedProducts(4);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-stone-light bg-cream-dark">
        <div className="page-container flex flex-col items-center gap-6 py-24 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold-dark">
            Fragrance blog &amp; boutique
          </p>
          <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Buzz&rsquo;s Scents
          </h1>
          <p className="max-w-xl text-base text-stone sm:text-lg">
            Curated fragrances, honest reviews, and a personal collection built one
            bottle at a time. If it&rsquo;s on the blog, chances are it&rsquo;s in the
            shop too.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/shop" className="btn-primary">
              Shop Fragrances <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/blog" className="btn-secondary">
              Read the Blog
            </Link>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="page-container py-16 text-center">
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          From the blog to your shelf
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-stone">
          Buzz&rsquo;s Scents started as a fragrance blog — reviews, comparisons, and
          collection updates. Now, fragrances I personally own and love are
          available to buy directly, in limited quantities, straight from my
          collection.
        </p>
      </section>

      {/* Featured products */}
      <section className="page-container pb-20">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-ink">Featured Fragrances</h2>
          <Link href="/shop" className="text-sm font-medium text-gold-dark hover:underline">
            View all
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-stone">
            No fragrances available right now — check back soon, or read the blog in
            the meantime.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
