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
	gender text not null default 'unisex' check (gender in ('men', 'women', 'unisex')),
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
insert into public.assay_fragrances (slug, name, house, released, family, gender, regime, sizes, search_query)
values
	-- Regime A: routinely discounted 40-60% below MSRP, so street price sits
	-- far under sticker and MSRP is useless as an anchor.
	('sauvage-edp', 'Sauvage Eau de Parfum', 'Dior', 2018, 'Aromatic fougere', 'men', 'A', '{60,100,200}', 'Dior Sauvage Eau de Parfum'),
	('sauvage-elixir', 'Sauvage Elixir', 'Dior', 2021, 'Spicy amber', 'men', 'A', '{60,100}', 'Dior Sauvage Elixir'),
	('dior-homme-intense', 'Dior Homme Intense', 'Dior', 2011, 'Iris woody', 'men', 'A', '{50,100}', 'Dior Homme Intense'),
	('eros-edt', 'Eros', 'Versace', 2012, 'Aromatic fougere', 'men', 'A', '{30,50,100,200}', 'Versace Eros Eau de Toilette'),
	('one-million', '1 Million', 'Paco Rabanne', 2008, 'Spicy leather', 'men', 'A', '{50,100,200}', 'Paco Rabanne 1 Million'),
	('invictus', 'Invictus', 'Paco Rabanne', 2013, 'Aquatic woody', 'men', 'A', '{50,100,200}', 'Paco Rabanne Invictus'),
	('acqua-di-gio', 'Acqua di Gio', 'Giorgio Armani', 1996, 'Aquatic', 'men', 'A', '{50,100,200}', 'Armani Acqua di Gio Eau de Toilette'),
	('stronger-with-you', 'Stronger With You', 'Giorgio Armani', 2017, 'Sweet spicy', 'men', 'A', '{50,100}', 'Armani Stronger With You'),
	('le-male', 'Le Male', 'Jean Paul Gaultier', 1995, 'Aromatic fougere', 'men', 'A', '{75,125,200}', 'Jean Paul Gaultier Le Male'),
	('la-nuit-de-lhomme', 'La Nuit de L''Homme', 'Yves Saint Laurent', 2009, 'Woody spicy', 'men', 'A', '{60,100}', 'YSL La Nuit de L Homme'),
	('ysl-y-edp', 'Y Eau de Parfum', 'Yves Saint Laurent', 2018, 'Aromatic fougere', 'men', 'A', '{60,100}', 'YSL Y Eau de Parfum'),
	('the-most-wanted', 'The Most Wanted', 'Azzaro', 2021, 'Spicy amber', 'men', 'A', '{50,100}', 'Azzaro The Most Wanted'),
	('bad-boy', 'Bad Boy', 'Carolina Herrera', 2019, 'Spicy woody', 'men', 'A', '{50,100}', 'Carolina Herrera Bad Boy'),
	('prada-lhomme', 'L''Homme', 'Prada', 2016, 'Iris woody', 'men', 'A', '{50,100,150}', 'Prada L Homme'),
	('khamrah', 'Khamrah', 'Lattafa', 2022, 'Spicy vanilla', 'unisex', 'A', '{100}', 'Lattafa Khamrah'),
	('jadore-edp', 'J''adore Eau de Parfum', 'Dior', 1999, 'Floral', 'women', 'A', '{30,50,100}', 'Dior J adore Eau de Parfum'),
	('miss-dior-edp', 'Miss Dior Eau de Parfum', 'Dior', 2017, 'Floral chypre', 'women', 'A', '{30,50,100}', 'Miss Dior Eau de Parfum'),
	('libre-edp', 'Libre Eau de Parfum', 'Yves Saint Laurent', 2019, 'Floral lavender', 'women', 'A', '{30,50,90}', 'YSL Libre Eau de Parfum'),
	('black-opium', 'Black Opium', 'Yves Saint Laurent', 2014, 'Coffee vanilla', 'women', 'A', '{30,50,90}', 'YSL Black Opium Eau de Parfum'),
	('la-vie-est-belle', 'La Vie Est Belle', 'Lancome', 2012, 'Sweet gourmand', 'women', 'A', '{30,50,100}', 'Lancome La Vie Est Belle'),
	('idole-edp', 'Idole', 'Lancome', 2019, 'Floral chypre', 'women', 'A', '{25,50,75}', 'Lancome Idole Eau de Parfum'),
	('flowerbomb', 'Flowerbomb', 'Viktor & Rolf', 2005, 'Floral gourmand', 'women', 'A', '{30,50,100}', 'Viktor Rolf Flowerbomb'),
	('daisy-edt', 'Daisy', 'Marc Jacobs', 2007, 'Floral woody', 'women', 'A', '{50,100}', 'Marc Jacobs Daisy Eau de Toilette'),
	('by-the-fireplace', 'Replica By the Fireplace', 'Maison Margiela', 2015, 'Woody gourmand', 'unisex', 'A', '{30,100}', 'Maison Margiela Replica By the Fireplace'),

	-- Regime B: little or no discounting, so street price sits close to MSRP
	-- and the decant split floor starts to bite at the top of the range.
	('aventus', 'Aventus', 'Creed', 2010, 'Fruity chypre', 'men', 'B', '{50,100,120}', 'Creed Aventus'),
	('green-irish-tweed', 'Green Irish Tweed', 'Creed', 1985, 'Fresh fougere', 'men', 'B', '{50,100}', 'Creed Green Irish Tweed'),
	('baccarat-540', 'Baccarat Rouge 540', 'Maison Francis Kurkdjian', 2015, 'Amber floral', 'unisex', 'B', '{35,70,200}', 'Baccarat Rouge 540'),
	('grand-soir', 'Grand Soir', 'Maison Francis Kurkdjian', 2016, 'Amber vanilla', 'unisex', 'B', '{70,200}', 'MFK Grand Soir'),
	('oud-wood', 'Oud Wood', 'Tom Ford', 2007, 'Woody oriental', 'unisex', 'B', '{30,50,100}', 'Tom Ford Oud Wood'),
	('tobacco-vanille', 'Tobacco Vanille', 'Tom Ford', 2007, 'Spicy vanilla', 'unisex', 'B', '{50,100}', 'Tom Ford Tobacco Vanille'),
	('layton', 'Layton', 'Parfums de Marly', 2016, 'Amber vanilla', 'unisex', 'B', '{75,125}', 'Parfums de Marly Layton'),
	('herod', 'Herod', 'Parfums de Marly', 2012, 'Tobacco vanilla', 'men', 'B', '{75,125}', 'Parfums de Marly Herod'),
	('delina', 'Delina', 'Parfums de Marly', 2017, 'Floral fruity', 'women', 'B', '{30,75}', 'Parfums de Marly Delina'),
	('oud-for-greatness', 'Oud for Greatness', 'Initio', 2019, 'Woody oud', 'unisex', 'B', '{90}', 'Initio Oud for Greatness'),
	('naxos', 'Naxos', 'Xerjoff', 2015, 'Tobacco honey', 'unisex', 'B', '{50,100}', 'Xerjoff Naxos'),
	('santal-33', 'Santal 33', 'Le Labo', 2011, 'Woody sandalwood', 'unisex', 'B', '{50,100}', 'Le Labo Santal 33'),
	('gypsy-water', 'Gypsy Water', 'Byredo', 2008, 'Woody aromatic', 'unisex', 'B', '{50,100}', 'Byredo Gypsy Water'),
	('bleu-de-chanel', 'Bleu de Chanel Parfum', 'Chanel', 2018, 'Woody aromatic', 'men', 'B', '{50,100,150}', 'Bleu de Chanel Parfum'),
	('coco-mademoiselle', 'Coco Mademoiselle', 'Chanel', 2001, 'Floral chypre', 'women', 'B', '{35,50,100}', 'Chanel Coco Mademoiselle Eau de Parfum'),
	('chance-eau-tendre', 'Chance Eau Tendre', 'Chanel', 2010, 'Floral fruity', 'women', 'B', '{35,50,100}', 'Chanel Chance Eau Tendre'),

	-- Regime C: discontinued or reformulated. No street anchor exists, age
	-- reads as provenance rather than decay, and comps carry the price alone.
	('mitsouko-vintage', 'Mitsouko (pre-2013 formula)', 'Guerlain', 1919, 'Chypre', 'women', 'C', '{50,75,100}', 'Guerlain Mitsouko vintage'),
	('kouros-vintage', 'Kouros (vintage splash)', 'Yves Saint Laurent', 1981, 'Aromatic fougere', 'men', 'C', '{50,100}', 'YSL Kouros vintage'),
	('angel-vintage', 'Angel (pre-reformulation)', 'Thierry Mugler', 1992, 'Gourmand', 'women', 'C', '{25,50,100}', 'Thierry Mugler Angel vintage'),
	('fahrenheit-vintage', 'Fahrenheit (vintage)', 'Dior', 1988, 'Leather floral', 'men', 'C', '{50,100}', 'Dior Fahrenheit vintage')
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
