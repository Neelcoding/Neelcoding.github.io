"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validation";

export interface ContactActionState {
  error?: string;
  success?: boolean;
}

/**
 * Saves a contact form submission to the database. Uses the service-role
 * ("admin") client because anonymous visitors submit this form and we want
 * it to work reliably regardless of RLS. Only the admin can ever read the
 * contact_messages table (see 0002_policies.sql).
 */
export async function submitContactForm(
  _prevState: ContactActionState | undefined,
  formData: FormData
): Promise<ContactActionState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your form entries." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").insert(parsed.data);

  if (error) return { error: "Something went wrong. Please try again." };

  return { success: true };
}
