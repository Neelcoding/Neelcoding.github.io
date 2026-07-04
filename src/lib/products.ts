import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export interface ProductFilters {
  search?: string;
  brand?: string;
  concentration?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in-stock" | "sold-out" | "all";
  sort?: "newest" | "price-asc" | "price-desc";
}

/** Fetches active products for the public Shop page, with filters/sorting. */
export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("is_active", true);

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`);
  }
  if (filters.brand) query = query.eq("brand", filters.brand);
  if (filters.concentration) query = query.eq("concentration", filters.concentration);
  if (filters.category) query = query.eq("category", filters.category);
  if (typeof filters.minPrice === "number") query = query.gte("price", filters.minPrice);
  if (typeof filters.maxPrice === "number") query = query.lte("price", filters.maxPrice);
  if (filters.availability === "in-stock") query = query.eq("is_sold_out", false);
  if (filters.availability === "sold-out") query = query.eq("is_sold_out", true);

  switch (filters.sort) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(sortProductImages);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("is_active", true)
    .eq("is_sold_out", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(sortProductImages);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? sortProductImages(data) : null;
}

/** Distinct brand list, used to populate the Shop page brand filter. */
export async function getBrands(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("brand")
    .eq("is_active", true);

  if (error) throw error;
  return Array.from(new Set((data ?? []).map((p) => p.brand))).sort();
}

function sortProductImages(product: Product): Product {
  return {
    ...product,
    product_images: [...(product.product_images ?? [])].sort(
      (a, b) => a.position - b.position
    ),
  };
}
