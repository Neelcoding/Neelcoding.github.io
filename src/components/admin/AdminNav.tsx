"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { logout } from "@/lib/actions/auth";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-stone-light bg-white">
      <div className="page-container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="font-serif text-lg font-semibold text-ink">
            Buzz&rsquo;s Scents Admin
          </Link>
          <nav className="hidden gap-6 sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "text-sm font-medium",
                  pathname === link.href ? "text-gold-dark" : "text-stone hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-stone hover:text-ink">
            View Site
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm font-medium text-stone hover:text-ink">
              Log Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
