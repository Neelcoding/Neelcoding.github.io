"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";

const CONCENTRATIONS = ["EDT", "EDP", "Parfum", "Extrait"];
const CATEGORIES = ["men", "women", "unisex"];

export default function ShopFilters({ brands }: { brands: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("search", search);
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fragrances or brands..."
          className="input-field pl-10"
        />
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <select
          className="input-field"
          value={searchParams.get("brand") ?? ""}
          onChange={(e) => updateParam("brand", e.target.value)}
        >
          <option value="">All Brands</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>

        <select
          className="input-field"
          value={searchParams.get("concentration") ?? ""}
          onChange={(e) => updateParam("concentration", e.target.value)}
        >
          <option value="">All Concentrations</option>
          {CONCENTRATIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="input-field"
          value={searchParams.get("category") ?? ""}
          onChange={(e) => updateParam("category", e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={0}
          placeholder="Min $"
          className="input-field"
          defaultValue={searchParams.get("minPrice") ?? ""}
          onBlur={(e) => updateParam("minPrice", e.target.value)}
        />

        <input
          type="number"
          min={0}
          placeholder="Max $"
          className="input-field"
          defaultValue={searchParams.get("maxPrice") ?? ""}
          onBlur={(e) => updateParam("maxPrice", e.target.value)}
        />

        <select
          className="input-field"
          value={searchParams.get("availability") ?? ""}
          onChange={(e) => updateParam("availability", e.target.value)}
        >
          <option value="">All Availability</option>
          <option value="in-stock">In Stock</option>
          <option value="sold-out">Sold Out</option>
        </select>
      </div>

      <div className="flex justify-end">
        <select
          className="input-field w-full sm:w-56"
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          <option value="newest">Sort: Newest</option>
          <option value="price-asc">Sort: Price (Low to High)</option>
          <option value="price-desc">Sort: Price (High to Low)</option>
        </select>
      </div>
    </div>
  );
}
