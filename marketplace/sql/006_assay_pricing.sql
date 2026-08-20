-- ---------- Assay: the price estimator ----------
-- Deliberately separate from the marketplace tables. The estimator is meant to
-- be liftable onto its own surface later, so everything it owns carries the
-- assay_ prefix and nothing in the listings flow references it.
--
-- Writes are service_role only. No insert or update policy is defined for the
-- data tables, so the anon key can read them and nothing else; the ingestion
-- edge function bypasses RLS with the service key. The one exception is
-- assay_valuations, which the page inserts into so every quote is logged.

-- ---------- Canonical catalogue ----------
-- The marketplace stores brand and name as free text per listing. Pricing
-- needs one agreed row per fragrance to hang observations off, which is what
-- this is.
create table if not exists public.assay_fragrances (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,
	name text not null,
	house text not null,
	released integer,
	family text,
	-- A: in production, heavily discounted. B: in production, little
	-- discounting. C: discontinued or reformulated, priced off comps alone.
	regime text not null default 'A' check (regime in ('A', 'B', 'C')),
	sizes integer[] not null default '{}',
	-- What the ingester searches for. Defaults to "house name", but flankers
	-- and fakes mean some fragrances need a hand-tuned query.
	search_query text,
	active boolean not null default true,
	created_at timestamptz not null default now()
);

create index if not exists assay_fragrances_active_idx on public.assay_fragrances (active);

-- ---------- Street price ----------
-- New and sealed observations. The anchor for regimes A and B, because almost
-- nobody pays MSRP and anchoring to sticker produces nonsense.
create table if not exists public.assay_street_prices (
	id uuid primary key default gen_random_uuid(),
	fragrance_id uuid not null references public.assay_fragrances (id) on delete cascade,
	size_ml integer not null check (size_ml > 0),
	price numeric(10, 2) not null check (price > 0),
	currency text not null default 'USD',
	source text not null,
	external_id text,
	observed_at timestamptz not null default now()
);

create index if not exists assay_street_frag_idx on public.assay_street_prices (fragrance_id, size_ml, observed_at desc);
-- One row per source listing, so a re-run refreshes rather than duplicates.
create unique index if not exists assay_street_dedupe_idx
	on public.assay_street_prices (source, external_id)
	where external_id is not null;

-- ---------- Comparable observations ----------
create table if not exists public.assay_comps (
	id uuid primary key default gen_random_uuid(),
	fragrance_id uuid not null references public.assay_fragrances (id) on delete cascade,
	size_ml integer not null check (size_ml > 0),
	fill_pct integer check (fill_pct between 1 and 100),
	condition text check (condition in ('mint', 'light', 'marked', 'faulty')),
	box_included text check (box_included in ('yes', 'no', 'damaged')),
	batch_year integer,
	price numeric(10, 2) not null check (price > 0),
	currency text not null default 'USD',
	-- Asking prices come from active listings and skew high; sold prices are
	-- the real signal. Both live here with a flag so the model can weight them
	-- differently, rather than a list price being mistaken for a sale.
	kind text not null default 'asking' check (kind in ('asking', 'sold')),
	source text not null,
	external_id text,
	observed_at timestamptz not null default now()
);

create index if not exists assay_comps_frag_idx on public.assay_comps (fragrance_id, size_ml, observed_at desc);
create index if not exists assay_comps_kind_idx on public.assay_comps (kind);
create unique index if not exists assay_comps_dedupe_idx
	on public.assay_comps (source, external_id)
	where external_id is not null;

-- ---------- Quote log ----------
-- Every estimate the tool gives, with the inputs that produced it.
create table if not exists public.assay_valuations (
	id uuid primary key default gen_random_uuid(),
	fragrance_id uuid references public.assay_fragrances (id) on delete set null,
	inputs jsonb not null,
	value numeric(10, 2),
	low numeric(10, 2),
	high numeric(10, 2),
	confidence text,
	comp_count integer,
	model_version text,
	created_at timestamptz not null default now(),
	-- Backfilled when a quoted bottle actually sells. This column is the whole
	-- reason to log quotes: without it the model can never be back-tested, and
	-- opened_factor stays a guess forever.
	actual_sale_price numeric(10, 2),
	actual_sold_at timestamptz
);

create index if not exists assay_valuations_frag_idx on public.assay_valuations (fragrance_id, created_at desc);
create index if not exists assay_valuations_backtest_idx
	on public.assay_valuations (created_at desc)
	where actual_sale_price is not null;

-- ---------- Model parameters ----------
-- Versioned so the curve can be tuned without a redeploy, and so a quote can
-- always be traced back to the numbers that produced it.
create table if not exists public.assay_model_params (
	version text primary key,
	params jsonb not null,
	active boolean not null default false,
	created_at timestamptz not null default now()
);

-- ---------- Coverage ----------
-- Which fragrances actually have enough real data to quote on. Drives both the
-- refuse-below-three rule and the answer to "what still needs seeding".
create or replace view public.assay_coverage as
select
	f.id as fragrance_id,
	f.slug,
	f.name,
	f.house,
	s.size_ml,
	count(*) filter (where c.kind = 'sold') as sold_comps,
	count(*) filter (where c.kind = 'asking') as asking_comps,
	max(c.observed_at) as last_comp_at,
	(select count(*) from public.assay_street_prices sp
		where sp.fragrance_id = f.id and sp.size_ml = s.size_ml) as street_points
from public.assay_fragrances f
cross join lateral unnest(f.sizes) as s(size_ml)
left join public.assay_comps c
	on c.fragrance_id = f.id and c.size_ml = s.size_ml
group by f.id, f.slug, f.name, f.house, s.size_ml;

-- ---------- Row level security ----------

alter table public.assay_fragrances enable row level security;
alter table public.assay_street_prices enable row level security;
alter table public.assay_comps enable row level security;
alter table public.assay_valuations enable row level security;
alter table public.assay_model_params enable row level security;

create policy "Fragrances are viewable by everyone"
	on public.assay_fragrances for select
	using (true);

create policy "Street prices are viewable by everyone"
	on public.assay_street_prices for select
	using (true);

create policy "Comps are viewable by everyone"
	on public.assay_comps for select
	using (true);

create policy "Model parameters are viewable by everyone"
	on public.assay_model_params for select
	using (true);

-- The page logs its own quotes, so anonymous insert is allowed here and
-- nowhere else. Reading the log back is service_role only: it is internal
-- calibration data, not something to expose.
create policy "Anyone can log a valuation"
	on public.assay_valuations for insert
	with check (true);

-- ---------- Seed catalogue ----------
-- Mirrors the fragrances the estimator ships with, so the ingester has
-- something to search for on its first run. Safe to re-run.
insert into public.assay_fragrances (slug, name, house, released, family, regime, sizes, search_query)
values
	('aventus', 'Aventus', 'Creed', 2010, 'Fruity chypre', 'B', '{50,100,120}', 'Creed Aventus'),
	('baccarat-540', 'Baccarat Rouge 540', 'Maison Francis Kurkdjian', 2015, 'Amber floral', 'B', '{70,200}', 'Baccarat Rouge 540'),
	('sauvage-edp', 'Sauvage Eau de Parfum', 'Dior', 2018, 'Aromatic fougere', 'A', '{60,100}', 'Dior Sauvage Eau de Parfum'),
	('bleu-de-chanel', 'Bleu de Chanel Parfum', 'Chanel', 2018, 'Woody aromatic', 'A', '{50,100}', 'Bleu de Chanel Parfum'),
	('oud-wood', 'Oud Wood', 'Tom Ford', 2007, 'Woody oriental', 'B', '{50,100}', 'Tom Ford Oud Wood'),
	('mitsouko-vintage', 'Mitsouko (pre-2013 formula)', 'Guerlain', 1919, 'Chypre', 'C', '{75}', 'Guerlain Mitsouko vintage'),
	('kouros-vintage', 'Kouros (vintage splash)', 'Yves Saint Laurent', 1981, 'Aromatic fougere', 'C', '{100}', 'YSL Kouros vintage'),
	('layton', 'Layton', 'Parfums de Marly', 2016, 'Amber vanilla', 'B', '{125}', 'Parfums de Marly Layton')
on conflict (slug) do nothing;

-- ---------- Seed model parameters ----------
-- The priors from assay/PRICING-MODEL.md, recalibrated after the split floor
-- was found to overtake its own anchor at the original premiums.
insert into public.assay_model_params (version, params, active)
values ('v0.1', '{
	"opened": { "A": 0.78, "B": 0.85, "C": 0.90 },
	"condition": { "mint": 1.0, "light": 0.96, "marked": 0.88, "faulty": 0.75 },
	"box": { "yes": 1.0, "damaged": 0.97, "no": 0.93 },
	"age": [[2, 1.0], [5, 0.97], [10, 0.93], [999, 0.88]],
	"storage_over_5y": 0.95,
	"floor_multiplier": 0.495,
	"decant_premium": [[80, 1.0], [200, 1.25], [500, 1.5], [999999, 1.8]],
	"floor_ceiling": 0.95,
	"compound_cap": 0.45,
	"asking_haircut": 0.88,
	"bands": { "high": 0.12, "medium": 0.22, "low": 0.35 }
}'::jsonb, true)
on conflict (version) do nothing;
