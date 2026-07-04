"use client";

import Link from "next/link";
import { Instagram, Music2, Youtube } from "lucide-react";
import { useState } from "react";

const QUICK_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

// Update these to your real social profiles.
const SOCIAL_LINKS = [
  { href: "https://instagram.com", label: "Instagram", icon: Instagram },
  { href: "https://tiktok.com", label: "TikTok", icon: Music2 },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube },
];

export default function Footer() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="border-t border-stone-light bg-ink text-cream">
      <div className="page-container grid gap-10 py-14 md:grid-cols-4">
        <div>
          <p className="font-serif text-lg font-semibold">Buzz&rsquo;s Scents</p>
          <p className="mt-3 max-w-xs text-sm text-cream/70">
            A personal fragrance blog and boutique — curated scents, honest reviews.
          </p>
          <div className="mt-4 flex gap-3">
            {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/20 transition-colors hover:border-gold hover:text-gold"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cream/80">
            Quick Links
          </p>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-cream/70 hover:text-gold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cream/80">Admin</p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/admin/login" className="text-sm text-cream/70 hover:text-gold">
                Admin Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cream/80">
            Newsletter
          </p>
          <p className="mt-4 text-sm text-cream/70">
            Get new arrivals and blog posts in your inbox.
          </p>
          {subscribed ? (
            <p className="mt-3 text-sm text-gold">Thanks — you&rsquo;re on the list!</p>
          ) : (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                // Placeholder only — wire this up to your email provider
                // (e.g. Mailchimp, ConvertKit, Resend) when you're ready.
                e.preventDefault();
                setSubscribed(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-full border border-cream/20 bg-transparent px-4 py-2 text-sm placeholder:text-cream/40 focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold-light"
              >
                Join
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="border-t border-cream/10 py-5">
        <p className="page-container text-center text-xs text-cream/50">
          © {new Date().getFullYear()} Buzz&rsquo;s Scents. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
