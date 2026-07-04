import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatCard from "@/components/admin/StatCard";
import { formatDate, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: total }, { count: inStock }, { count: soldOut }, { data: recent }] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_sold_out", false)
        .gt("quantity", 0),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .or("is_sold_out.eq.true,quantity.eq.0"),
      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Dashboard</h1>
        <Link href="/admin/products/new" className="btn-primary">
          Add Fragrance
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Total Products" value={total ?? 0} />
        <StatCard label="In Stock" value={inStock ?? 0} />
        <StatCard label="Sold Out" value={soldOut ?? 0} />
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-serif text-lg font-semibold text-ink">Recently Added</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-dark/60 text-xs uppercase tracking-wide text-stone">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {(recent as Product[] | null)?.map((product) => (
                <tr key={product.id} className="border-t border-stone-light">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="font-medium text-ink hover:text-gold-dark"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone">{product.brand}</td>
                  <td className="px-4 py-3 text-stone">{formatPrice(product.price)}</td>
                  <td className="px-4 py-3 text-stone">{formatDate(product.created_at)}</td>
                </tr>
              ))}
              {(!recent || recent.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-stone">
                    No products yet — add your first fragrance to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
