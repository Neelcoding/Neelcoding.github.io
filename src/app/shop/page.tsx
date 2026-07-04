import { getBrands, getProducts, type ProductFilters } from "@/lib/products";
import ProductCard from "@/components/shop/ProductCard";
import ShopFilters from "@/components/shop/ShopFilters";

interface ShopPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;

  const filters: ProductFilters = {
    search: params.search,
    brand: params.brand,
    concentration: params.concentration,
    category: params.category,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    availability: (params.availability as ProductFilters["availability"]) || "all",
    sort: (params.sort as ProductFilters["sort"]) || "newest",
  };

  const [products, brands] = await Promise.all([getProducts(filters), getBrands()]);

  return (
    <div className="page-container py-12">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-ink">Shop Fragrances</h1>
        <p className="mt-2 text-stone">Browse the current collection, available now.</p>
      </div>

      <div className="mb-10">
        <ShopFilters brands={brands} />
      </div>

      {products.length === 0 ? (
        <p className="py-16 text-center text-stone">
          No fragrances match those filters. Try broadening your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
