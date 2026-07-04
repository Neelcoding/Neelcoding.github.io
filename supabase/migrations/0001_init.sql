-- Buzz's Scents — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- See /README.md for full setup instructions.

create extension if not exists "pgcrypto";

-- =========================================================
-- PRODUCTS
-- =========================================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text not null,
  price numeric(10, 2) not null check (price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  size text not null, -- e.g. "50ml", "100ml"
  concentration text not null default 'EDT', -- EDT, EDP, Parfum, Extrait
  condition text not null default 'new', -- new, used, tester, decant
  category text not null default 'unisex', -- men, women, unisex
  short_description text,
  description text,
  top_notes text,
  middle_notes text,
  base_notes text,
  longevity text, -- e.g. "6-8 hours"
  projection text, -- e.g. "moderate"
  season text, -- e.g. "fall, winter"
  occasion text, -- e.g. "evening, date night"
  is_active boolean not null default true, -- admin can hide a product without deleting it
  is_sold_out boolean not null default false, -- manual override; also true whenever quantity = 0
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_created_at_idx on products (created_at desc);
create index if not exists products_brand_idx on products (brand);
create index if not exists products_category_idx on products (category);
create index if not exists products_is_active_idx on products (is_active);

-- Keep is_sold_out in sync with quantity automatically.
create or replace function sync_product_sold_out()
returns trigger as $$
begin
  if new.quantity <= 0 then
    new.is_sold_out := true;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_product_sold_out on products;
create trigger trg_sync_product_sold_out
  before insert or update on products
  for each row execute function sync_product_sold_out();

-- =========================================================
-- PRODUCT IMAGES
-- =========================================================
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_id_idx on product_images (product_id, position);

-- =========================================================
-- ORDERS
-- =========================================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  customer_email text,
  customer_name text,
  amount_total numeric(10, 2) not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending', -- pending, paid, failed, refunded
  shipping_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on orders (status);
create index if not exists orders_stripe_session_id_idx on orders (stripe_session_id);

-- =========================================================
-- ORDER ITEMS
-- =========================================================
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  product_name text not null, -- snapshot, survives product deletion
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on order_items (order_id);

-- =========================================================
-- BLOG POSTS
-- =========================================================
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content text, -- markdown / plain text
  cover_image text,
  category text not null default 'general', -- review, top10, guide, general
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_idx on blog_posts (published, published_at desc);

-- =========================================================
-- CONTACT MESSAGES (from the public Contact page form)
-- =========================================================
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);
