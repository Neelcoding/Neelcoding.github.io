import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/supabase/admin-check";
import AdminNav from "@/components/admin/AdminNav";

// Every page under this route group requires a logged-in admin. Middleware
// (src/middleware.ts) already redirects logged-out visitors to /admin/login,
// but we check again here — server-side, on every request — because that's
// the check that actually decides whether admin data gets fetched at all.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-cream-dark/40">
      <AdminNav />
      <div className="page-container py-10">{children}</div>
    </div>
  );
}
