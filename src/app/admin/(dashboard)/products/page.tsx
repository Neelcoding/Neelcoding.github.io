import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductTable from "@/components/admin/ProductTable";
import type { Product } from "@/lib/types";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">
          Add Fragrance
        </Link>
      </div>

      <ProductTable products={(products as Product[]) ?? []} />
    </div>
  );
}
