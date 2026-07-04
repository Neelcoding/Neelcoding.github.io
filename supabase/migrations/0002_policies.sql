-- Buzz's Scents — Row Level Security policies
--
-- Admin model: there is no public sign-up form anywhere in this app. The only
-- way a Supabase Auth account gets created is you creating it yourself (see
-- README "Create your admin account"). Because of that, it's safe to treat
-- "authenticated" as "the admin" and grant it full read/write access, while
-- "anon" (everyone else visiting the site) only gets read access to public,
-- active/published rows. The app additionally checks the logged-in user's
-- email against ADMIN_EMAILS on every admin page/action as a second layer
-- of defense — see src/lib/supabase/admin-check.ts.

alter table products enable row level security;
alter table product_images enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table blog_posts enable row level security;
alter table contact_messages enable row level security;

-- ---------- products ----------
create policy "Public can view active products"
  on products for select
  to anon, authenticated
  using (is_active = true);

create policy "Admin can view all products"
  on products for select
  to authenticated
  using (true);

create policy "Admin can insert products"
  on products for insert
  to authenticated
  with check (true);

create policy "Admin can update products"
  on products for update
  to authenticated
  using (true)
  with check (true);

create policy "Admin can delete products"
  on products for delete
  to authenticated
  using (true);

-- ---------- product_images ----------
create policy "Public can view images of active products"
  on product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from products
      where products.id = product_images.product_id
        and products.is_active = true
    )
  );

create policy "Admin can manage product images"
  on product_images for all
  to authenticated
  using (true)
  with check (true);

-- ---------- orders ----------
-- No anon access at all — orders are only ever written by the server
-- (checkout / webhook routes) using the Supabase service role key, which
-- bypasses RLS entirely. Only the logged-in admin can read them.
create policy "Admin can view orders"
  on orders for select
  to authenticated
  using (true);

-- ---------- order_items ----------
create policy "Admin can view order items"
  on order_items for select
  to authenticated
  using (true);

-- ---------- blog_posts ----------
create policy "Public can view published posts"
  on blog_posts for select
  to anon, authenticated
  using (published = true);

create policy "Admin can manage blog posts"
  on blog_posts for all
  to authenticated
  using (true)
  with check (true);

-- ---------- contact_messages ----------
-- Anyone can submit the contact form, but only the admin can read messages.
-- (Inserts actually go through the server using the service role key, so
-- this insert policy is a fallback, not the primary path.)
create policy "Anyone can submit a contact message"
  on contact_messages for insert
  to anon, authenticated
  with check (true);

create policy "Admin can view contact messages"
  on contact_messages for select
  to authenticated
  using (true);
