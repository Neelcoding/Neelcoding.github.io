"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminUser } from "@/lib/supabase/admin-check";
import { productSchema } from "@/lib/validation";
import { slugify } from "@/lib/format";

export interface ProductActionState {
  error?: string;
}

/** Throws if the current user isn't an authorized admin. Call this first in every admin action. */
async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not authorized.");
  return admin;
}

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand"),
    price: formData.get("price"),
    quantity: formData.get("quantity"),
    size: formData.get("size"),
    concentration: formData.get("concentration"),
    condition: formData.get("condition"),
    category: formData.get("category"),
    short_description: formData.get("short_description"),
    description: formData.get("description"),
    top_notes: formData.get("top_notes"),
    middle_notes: formData.get("middle_notes"),
    base_notes: formData.get("base_notes"),
    longevity: formData.get("longevity"),
    projection: formData.get("projection"),
    season: formData.get("season"),
    occasion: formData.get("occasion"),
    is_active: formData.get("is_active") === "on",
    is_sold_out: formData.get("is_sold_out") === "on",
  });
}

/** Creates a product. `imageUrls` are already-uploaded Supabase Storage URLs (see ImageUploader). */
export async function createProduct(
  _prevState: ProductActionState | undefined,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product data." };
  }

  const imageUrls = formData.getAll("image_urls").map(String).filter(Boolean);
  const supabase = await createClient();

  const baseSlug = slugify(`${parsed.data.brand}-${parsed.data.name}-${parsed.data.size}`);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: product, error } = await supabase
    .from("products")
    .insert({ ...parsed.data, slug })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (imageUrls.length > 0) {
    const rows = imageUrls.map((url, index) => ({
      product_id: product.id,
      url,
      position: index,
    }));
    const { error: imgError } = await supabase.from("product_images").insert(rows);
    if (imgError) return { error: imgError.message };
  }

  revalidatePath("/shop");
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProduct(
  productId: string,
  _prevState: ProductActionState | undefined,
  formData: FormData
): Promise<ProductActionState> {
  await requireAdmin();

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product data." };
  }

  const newImageUrls = formData.getAll("new_image_urls").map(String).filter(Boolean);
  const supabase = await createClient();

  const { error } = await supabase.from("products").update(parsed.data).eq("id", productId);
  if (error) return { error: error.message };

  if (newImageUrls.length > 0) {
    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    const rows = newImageUrls.map((url, index) => ({
      product_id: productId,
      url,
      position: (count ?? 0) + index,
    }));
    const { error: imgError } = await supabase.from("product_images").insert(rows);
    if (imgError) return { error: imgError.message };
  }

  revalidatePath("/shop");
  revalidatePath(`/product/${productId}`);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function deleteProduct(productId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/shop");
  revalidatePath("/admin/products");
}

export async function deleteProductImage(imageId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/shop");
  revalidatePath("/admin/products");
}

export async function toggleProductSoldOut(productId: string, isSoldOut: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_sold_out: isSoldOut })
    .eq("id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/shop");
  revalidatePath("/admin/products");
}
