// Shared TypeScript types, mirroring the Supabase schema in
// /supabase/migrations. Keep these in sync if you change the database.

export type Concentration = "EDT" | "EDP" | "Parfum" | "Extrait";
export type Condition = "new" | "used" | "tester" | "decant";
export type Category = "men" | "women" | "unisex";

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  position: number;
  created_at: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  size: string;
  concentration: string;
  condition: string;
  category: string;
  short_description: string | null;
  description: string | null;
  top_notes: string | null;
  middle_notes: string | null;
  base_notes: string | null;
  longevity: string | null;
  projection: string | null;
  season: string | null;
  occasion: string | null;
  is_active: boolean;
  is_sold_out: boolean;
  created_at: string;
  updated_at: string;
  product_images?: ProductImage[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  category: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  shipping_address: unknown;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  created_at: string;
}

// A single line in the client-side shopping cart (persisted to localStorage).
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  image: string | null;
  size: string;
  quantity: number;
  maxQuantity: number;
}
