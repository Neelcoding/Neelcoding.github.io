import { z } from "zod";

// Shared validation for the admin "add/edit fragrance" form.
// Used both client-side (instant feedback) and server-side (never trust the
// client — see src/lib/actions/products.ts) before writing to the database.
export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  brand: z.string().trim().min(1, "Brand is required").max(120),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  quantity: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
  size: z.string().trim().min(1, "Size is required (e.g. 50ml)"),
  concentration: z.enum(["EDT", "EDP", "Parfum", "Extrait"]),
  condition: z.enum(["new", "used", "tester", "decant"]),
  category: z.enum(["men", "women", "unisex"]),
  short_description: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  top_notes: z.string().trim().optional().or(z.literal("")),
  middle_notes: z.string().trim().optional().or(z.literal("")),
  base_notes: z.string().trim().optional().or(z.literal("")),
  longevity: z.string().trim().optional().or(z.literal("")),
  projection: z.string().trim().optional().or(z.literal("")),
  season: z.string().trim().optional().or(z.literal("")),
  occasion: z.string().trim().optional().or(z.literal("")),
  is_active: z.coerce.boolean().default(true),
  is_sold_out: z.coerce.boolean().default(false),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
