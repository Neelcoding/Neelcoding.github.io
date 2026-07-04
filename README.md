# Buzz's Scents

A full-stack fragrance e-commerce site + blog, built with Next.js (App Router),
TypeScript, Tailwind CSS, Supabase, and Stripe Checkout.

- Public site: browse fragrances, view details, add to cart, check out with Stripe.
- Admin dashboard at `/admin`: add/edit/delete fragrances, manage stock, upload photos.
- New fragrances added in `/admin` show up on `/shop` immediately — no code changes needed.

---

## 1. Project structure

```
src/
  app/
    page.tsx                     Home page
    shop/page.tsx                Shop (filters, search, sort)
    product/[slug]/page.tsx      Product detail page
    cart/page.tsx                Cart page
    checkout/success/page.tsx    Post-payment success page
    checkout/cancel/page.tsx     Checkout canceled page
    blog/page.tsx                Blog listing
    blog/[slug]/page.tsx         Blog post detail
    about/page.tsx               About page
    contact/page.tsx             Contact page + FAQ
    admin/
      login/page.tsx             Admin login (public)
      (dashboard)/layout.tsx     Auth-gated layout for everything below
      (dashboard)/page.tsx       Dashboard (stats, recent products)
      (dashboard)/products/      Product list, add, edit
    api/
      checkout/route.ts          Creates a Stripe Checkout session
      webhooks/stripe/route.ts   Marks orders paid, decrements stock
  components/
    layout/        Header, Footer
    shop/           ProductCard, ShopFilters
    product/        ImageGallery, AddToCartButton
    cart/           CartItemRow, CheckoutButton
    blog/           BlogCard
    admin/          AdminNav, ProductForm, ProductTable, ImageUploader, StatCard
    ui/             Small shared UI pieces (Badge, etc.)
  lib/
    supabase/       client.ts (browser), server.ts (server components/actions),
                    admin.ts (service role, server-only), admin-check.ts
    actions/        Server Actions: products.ts, auth.ts, contact.ts
    stripe.ts       Server-only Stripe client
    products.ts     Data-fetching for the public shop
    blog.ts         Data-fetching for the blog
    cart-context.tsx  Client-side cart (localStorage)
    types.ts        Shared TypeScript types
    validation.ts   Zod schemas for forms
    format.ts       Price/date formatting, slugify
  middleware.ts     Protects /admin routes, refreshes Supabase session
supabase/
  migrations/       SQL migration files — run these in order
  seed.sql          Optional sample fragrances + blog post
```

---

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migration files **in order**:
   - `supabase/migrations/0001_init.sql` — tables
   - `supabase/migrations/0002_policies.sql` — Row Level Security policies
   - `supabase/migrations/0003_storage.sql` — image storage bucket
   - (optional) `supabase/seed.sql` — a few sample fragrances so the site isn't empty
3. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### Create your admin account

There is intentionally no public sign-up page. You create your own login directly in Supabase:

1. Go to **Authentication → Users → Add user** in the Supabase dashboard.
2. Enter your email and a password, and confirm the user.
3. Set `ADMIN_EMAILS` (in your `.env.local` / Vercel env vars) to that same email.
   You can list more than one, comma-separated, if you ever want a second admin.

That's it — anyone else who somehow creates a Supabase Auth account (there's no
way to, from this app) still wouldn't get into `/admin` unless their email is
in `ADMIN_EMAILS`. See `src/lib/supabase/admin-check.ts`.

---

## 3. Set up Stripe

1. Create a account at [stripe.com](https://stripe.com) (test mode is fine to start).
2. **Developers → API keys**: copy the **Secret key** → `STRIPE_SECRET_KEY`.
3. **Webhooks**:
   - In production: **Developers → Webhooks → Add endpoint**, URL =
     `https://yourdomain.com/api/webhooks/stripe`, event = `checkout.session.completed`.
     Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
   - Locally, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) instead:
     ```bash
     stripe listen --forward-to localhost:3000/api/webhooks/stripe
     ```
     This prints a webhook signing secret starting with `whsec_` — put that
     in your local `.env.local` as `STRIPE_WEBHOOK_SECRET`.

The webhook is what actually marks an order as `paid` and decrements product
stock (`src/app/api/webhooks/stripe/route.ts`) — without it, orders will stay
`pending` forever even though the customer was charged.

---

## 4. Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values from steps 2 & 3
npm run dev
```

Visit `http://localhost:3000` for the site and `http://localhost:3000/admin/login` to sign in.

If you're testing checkout locally, also run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
in a second terminal so webhook events reach your machine.

Use Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any CVC.

---

## 5. Deploy to Vercel

1. Push this repo to GitHub (if it isn't already).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Add every variable from `.env.example` under **Settings → Environment Variables**,
   using your real Supabase/Stripe values. Set `NEXT_PUBLIC_SITE_URL` to your
   production URL (e.g. `https://buzzsscents.vercel.app` or your custom domain).
4. Deploy.
5. Add the production webhook endpoint in Stripe (see step 3 above) pointing at
   `https://<your-domain>/api/webhooks/stripe`, and set `STRIPE_WEBHOOK_SECRET`
   in Vercel to that endpoint's signing secret.
6. When you're ready to accept real payments, swap your Stripe keys from test
   (`sk_test_...`) to live (`sk_live_...`) mode and update the webhook similarly.

---

## 6. Adding fragrances (no code required)

1. Go to `/admin/login` and sign in.
2. Click **Add Fragrance**, fill in the details (name, brand, price, notes, etc.),
   upload photos, and save.
3. It appears on `/shop` immediately (as long as "Active" is checked).
4. When you sell out, either let it happen automatically (quantity reaches 0
   auto-marks it sold out) or manually check "Mark as sold out" from the
   product list.

---

## 7. Security notes

- `/admin/*` is protected by middleware (redirects logged-out visitors to
  `/admin/login`) **and** by a server-side check on every admin page/action
  (`getAdminUser()`), which also verifies the email against `ADMIN_EMAILS`.
- The Supabase `service_role` key and `STRIPE_SECRET_KEY` are only ever used
  in server-only files (marked with `import "server-only"`) — they are never
  sent to the browser.
- Row Level Security is enabled on every table. Public visitors can only read
  active products and published blog posts; only an authenticated (admin)
  session can write.
- All form input (product fields, contact form, cart checkout) is validated
  with Zod on the server before touching the database — never trust client input.
- Stripe Checkout line item prices are always re-read from the database, not
  from the browser, so the price a customer pays can't be tampered with.

---

## 8. Customizing

- **Brand colors**: `tailwind.config.ts` (`ink`, `cream`, `gold`, `stone`).
- **Social links / newsletter**: `src/components/layout/Footer.tsx` and
  `src/app/contact/page.tsx`.
- **Database schema**: add migration files under `supabase/migrations/` rather
  than editing old ones, so your history stays reproducible.
