import "server-only";
import { createClient } from "@/lib/supabase/server";

// ADMIN_EMAILS is a comma-separated allowlist, e.g. "you@example.com".
// This is the second layer of defense on top of RLS (see 0002_policies.sql):
// even though any logged-in Supabase Auth user is treated as "authenticated"
// by the database, only emails in this list are allowed to actually see or
// use the admin dashboard in the app itself.
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns the logged-in user if they're an admin, otherwise null. */
export async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const adminEmails = getAdminEmails();
  if (!adminEmails.includes(user.email.toLowerCase())) return null;

  return user;
}
