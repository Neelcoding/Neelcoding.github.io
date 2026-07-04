import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/admin/ProductForm";
import { updateProduct } from "@/lib/actions/products";
import type { Product } from "@/lib/types";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const action = updateProduct.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 font-serif text-2xl font-semibold text-ink">Edit Fragrance</h1>
      <ProductForm action={action} product={product as Product} submitLabel="Save Changes" />
    </div>
  );
}
