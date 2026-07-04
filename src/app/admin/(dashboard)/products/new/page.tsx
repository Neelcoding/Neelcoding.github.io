import ProductForm from "@/components/admin/ProductForm";
import { createProduct } from "@/lib/actions/products";

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 font-serif text-2xl font-semibold text-ink">Add a Fragrance</h1>
      <ProductForm action={createProduct} submitLabel="Add Fragrance" />
    </div>
  );
}
