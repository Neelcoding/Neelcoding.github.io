"use client";

// Supabase client for use in the browser (client components).
// Uses the public anon key, which is safe to expose — access is controlled
// by Row Level Security policies (see /supabase/migrations/0002_policies.sql).

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
