import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Admin ("service role") Supabase client — bypasses Row Level Security.
//
// SECURITY: This must NEVER be imported into a client component or exposed
// to the browser. It is only safe to use inside:
//   - API routes (src/app/api/**)
//   - Server Actions that have already verified the caller is an admin
// The `server-only` import above makes Next.js throw a build error if this
// file is ever accidentally imported from client-side code.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
